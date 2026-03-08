"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Image as ImageIcon, Loader2, PencilLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploader } from "@/components/photo-uploader";
import { useAuth } from "@/components/auth-provider";
import { PhotoAsset } from "@/lib/store";
import { AppHeader } from "@/components/app-header";
import { sessionService } from "@/lib/sessions";
import { CUSTOM_GENERATION_COST } from "@/lib/custom-generation";
import { userService } from "@/lib/users";
import { extractR2KeyFromReference } from "@/lib/reference-assets";
import { assetService } from "@/lib/assets";
import { consumeCustomGeneratorDraft } from "@/lib/custom-generator-draft";

function CustomGeneratorContent() {
    const { user, userProfile, loading, logout } = useAuth();
    const searchParams = useSearchParams();
    const userId = user?.uid ?? "";
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [assets, setAssets] = useState<PhotoAsset[]>([]);
    const [resolvedEditImageUrl, setResolvedEditImageUrl] = useState("");
    const [isResolvingEditImage, setIsResolvingEditImage] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);
    const [brushSize, setBrushSize] = useState(38);
    const [isPainting, setIsPainting] = useState(false);
    const [hasMask, setHasMask] = useState(false);
    const [maskReady, setMaskReady] = useState(false);
    const [sessionSaveStatus, setSessionSaveStatus] = useState<"idle" | "saved" | "failed">("idle");
    const [sessionSaveMessage, setSessionSaveMessage] = useState<string | null>(null);
    const [materialSaveStatus, setMaterialSaveStatus] = useState<"idle" | "saved" | "failed">("idle");
    const [materialSaveMessage, setMaterialSaveMessage] = useState<string | null>(null);
    const [restoredDraftMessage, setRestoredDraftMessage] = useState<string | null>(null);

    const baseImageRef = useRef<HTMLImageElement | null>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const editImageUrl = useMemo(() => searchParams.get("edit")?.trim() ?? "", [searchParams]);
    const editImageKey = useMemo(() => searchParams.get("editKey")?.trim() ?? "", [searchParams]);
    const sourceSessionId = useMemo(() => searchParams.get("sessionId")?.trim() ?? "", [searchParams]);
    const isEditMode = editImageUrl.length > 0 || editImageKey.length > 0;
    const availableCredits = userProfile?.credits ?? 0;
    const missingCredits = Math.max(0, CUSTOM_GENERATION_COST - availableCredits);
    const hasEnoughCredits = availableCredits >= CUSTOM_GENERATION_COST;
    const [resolvedSourceSessionId, setResolvedSourceSessionId] = useState(sourceSessionId);

    const addAsset = (asset: PhotoAsset) => setAssets(prev => [...prev, asset]);
    const removeAsset = (id: string) => setAssets(prev => prev.filter(a => a.id !== id));

    const redrawOverlay = useCallback(() => {
        const image = baseImageRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!image || !overlayCanvas || !maskCanvas) return;

        const displayWidth = Math.max(1, Math.round(image.clientWidth));
        const displayHeight = Math.max(1, Math.round(image.clientHeight));
        if (!displayWidth || !displayHeight) return;

        if (overlayCanvas.width !== displayWidth || overlayCanvas.height !== displayHeight) {
            overlayCanvas.width = displayWidth;
            overlayCanvas.height = displayHeight;
        }

        const ctx = overlayCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        ctx.globalAlpha = 0.62;
        ctx.drawImage(maskCanvas, 0, 0, overlayCanvas.width, overlayCanvas.height);
        ctx.globalAlpha = 1;
    }, []);

    const clearMask = useCallback(() => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return;
        const maskCtx = maskCanvas.getContext("2d");
        if (!maskCtx) return;
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        setHasMask(false);
        redrawOverlay();
    }, [redrawOverlay]);

    const initializeMaskCanvas = useCallback(() => {
        const image = baseImageRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!image || !maskCanvas || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;

        maskCanvas.width = image.naturalWidth;
        maskCanvas.height = image.naturalHeight;
        const maskCtx = maskCanvas.getContext("2d");
        if (!maskCtx) return;
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        setHasMask(false);
        setMaskReady(true);
        redrawOverlay();
    }, [redrawOverlay]);

    const drawMaskAtPoint = useCallback((clientX: number, clientY: number) => {
        const image = baseImageRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!image || !maskCanvas) return;

        const rect = image.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;

        const normalizedX = (clientX - rect.left) / rect.width;
        const normalizedY = (clientY - rect.top) / rect.height;
        const x = normalizedX * maskCanvas.width;
        const y = normalizedY * maskCanvas.height;
        const radius = Math.max(6, (brushSize / rect.width) * maskCanvas.width * 0.5);

        const maskCtx = maskCanvas.getContext("2d");
        if (!maskCtx) return;

        maskCtx.fillStyle = "rgba(255,0,0,1)";
        maskCtx.beginPath();
        maskCtx.arc(x, y, radius, 0, Math.PI * 2);
        maskCtx.fill();

        if (!hasMask) setHasMask(true);
        redrawOverlay();
    }, [brushSize, hasMask, redrawOverlay]);

    const handleMaskPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!maskReady || !resolvedEditImageUrl || isResolvingEditImage) return;
        event.preventDefault();
        setIsPainting(true);
        drawMaskAtPoint(event.clientX, event.clientY);
    }, [drawMaskAtPoint, isResolvingEditImage, maskReady, resolvedEditImageUrl]);

    const handleMaskPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isPainting) return;
        event.preventDefault();
        drawMaskAtPoint(event.clientX, event.clientY);
    }, [drawMaskAtPoint, isPainting]);

    useEffect(() => {
        if (!isPainting) return;
        const stopPainting = () => setIsPainting(false);
        window.addEventListener("pointerup", stopPainting);
        window.addEventListener("pointercancel", stopPainting);
        return () => {
            window.removeEventListener("pointerup", stopPainting);
            window.removeEventListener("pointercancel", stopPainting);
        };
    }, [isPainting]);

    useEffect(() => {
        const image = baseImageRef.current;
        if (!image) return;

        const observer = new ResizeObserver(() => redrawOverlay());
        observer.observe(image);
        return () => observer.disconnect();
    }, [redrawOverlay, resolvedEditImageUrl]);

    useEffect(() => {
        if (!isEditMode) {
            setResolvedEditImageUrl("");
            setIsResolvingEditImage(false);
            setImageError(null);
            return;
        }

        if (editImageUrl) {
            setResolvedEditImageUrl(editImageUrl);
            setIsResolvingEditImage(false);
            setImageError(null);
            return;
        }

        if (!editImageKey) {
            setResolvedEditImageUrl("");
            setIsResolvingEditImage(false);
            setImageError("Brak zdjęcia źródłowego do edycji.");
            return;
        }

        let cancelled = false;
        setIsResolvingEditImage(true);
        setImageError(null);

        void (async () => {
            try {
                const response = await fetch("/api/view-urls", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keys: [editImageKey] }),
                });
                const payload = await response.json() as {
                    error?: string;
                    urls?: Array<{ key: string; url: string }>;
                };

                if (!response.ok) {
                    throw new Error(payload.error || "Nie udało się pobrać zdjęcia do edycji.");
                }

                const matched = payload.urls?.find((item) => item.key === editImageKey)?.url || "";
                if (!matched) {
                    throw new Error("Nie znaleziono zdjęcia do edycji.");
                }
                if (!cancelled) {
                    setResolvedEditImageUrl(matched);
                    setImageError(null);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : "Nie udało się załadować zdjęcia do edycji.";
                    setResolvedEditImageUrl("");
                    setImageError(message);
                }
            } finally {
                if (!cancelled) {
                    setIsResolvingEditImage(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [editImageKey, editImageUrl, isEditMode]);

    useEffect(() => {
        if (!isEditMode) return;
        setMaskReady(false);
        setHasMask(false);
        const overlayCanvas = overlayCanvasRef.current;
        if (overlayCanvas) {
            const ctx = overlayCanvas.getContext("2d");
            ctx?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
    }, [isEditMode, resolvedEditImageUrl]);

    useEffect(() => {
        setResolvedSourceSessionId(sourceSessionId);
    }, [sourceSessionId]);

    useEffect(() => {
        if (isEditMode) return;

        const draft = consumeCustomGeneratorDraft();
        if (!draft) return;

        if (draft.prompt) {
            setPrompt(draft.prompt);
        }

        if (draft.referenceAsset) {
            setAssets((prev) => {
                if (prev.some((asset) => asset.id === draft.referenceAsset?.id)) {
                    return prev;
                }
                return [draft.referenceAsset, ...prev].slice(0, 5);
            });
        }

        if (draft.prompt && draft.referenceAsset) {
            setRestoredDraftMessage("Załadowaliśmy zapisany prompt i dodaliśmy to zdjęcie jako referencję.");
        } else if (draft.referenceAsset) {
            setRestoredDraftMessage("Dodaliśmy wybrane zdjęcie jako referencję.");
        } else if (draft.prompt) {
            setRestoredDraftMessage("Załadowaliśmy zapisany prompt.");
        }
    }, [isEditMode]);

    const resolveSourceSessionId = useCallback(async (): Promise<string> => {
        if (sourceSessionId) {
            return sourceSessionId;
        }
        if (!user?.uid || !isEditMode) {
            return "";
        }

        const candidateUrls = [editImageUrl, resolvedEditImageUrl].filter((value) => value.length > 0);
        const candidateKeys = [
            editImageKey,
            extractR2KeyFromReference(editImageUrl) ?? "",
            extractR2KeyFromReference(resolvedEditImageUrl) ?? "",
        ].filter((value) => value.length > 0);

        if (candidateUrls.length === 0 && candidateKeys.length === 0) {
            return "";
        }

        const sessions = await sessionService.getUserSessions(user.uid);
        const matchedSession = sessions.find((session) =>
            session.results.some((resultUrl) => {
                if (candidateUrls.includes(resultUrl)) {
                    return true;
                }

                const resultKey = extractR2KeyFromReference(resultUrl);
                return Boolean(resultKey && candidateKeys.includes(resultKey));
            })
        );

        return matchedSession?.id ?? "";
    }, [editImageKey, editImageUrl, isEditMode, resolvedEditImageUrl, sourceSessionId, user?.uid]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        if (!user) {
            setError("Zaloguj się, aby wygenerować zdjęcie.");
            return;
        }
        if (!hasEnoughCredits) {
            setError(`Brakuje ${missingCredits} PKT, aby wygenerować zdjęcie.`);
            return;
        }

        let maskDataUrl: string | undefined;
        if (isEditMode) {
            if (!maskReady || !hasMask) {
                setError("Zaznacz czerwonym obszar, który chcesz zmienić.");
                return;
            }
            const maskCanvas = maskCanvasRef.current;
            if (!maskCanvas) {
                setError("Maska nie jest gotowa. Odśwież stronę i spróbuj ponownie.");
                return;
            }
            maskDataUrl = maskCanvas.toDataURL("image/png");
        }

        setIsGenerating(true);
        setError(null);
        setResultUrl(null);
        setSessionSaveStatus("idle");
        setSessionSaveMessage(null);
        setMaterialSaveStatus("idle");
        setMaterialSaveMessage(null);

        let didChargeCredits = false;
        let effectiveSourceSessionId = resolvedSourceSessionId;
        try {
            if (isEditMode && !effectiveSourceSessionId) {
                effectiveSourceSessionId = await resolveSourceSessionId();
                if (effectiveSourceSessionId) {
                    setResolvedSourceSessionId(effectiveSourceSessionId);
                }
            }

            await userService.chargeCredits(user.uid, CUSTOM_GENERATION_COST);
            didChargeCredits = true;

            const res = await fetch("/api/generate-custom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    referenceKeys: assets.map(a => a.id),
                    ...(isEditMode && editImageKey ? { editImageKey } : {}),
                    ...(isEditMode && resolvedEditImageUrl ? { editImageUrl: resolvedEditImageUrl } : {}),
                    ...(isEditMode && maskDataUrl ? { maskDataUrl } : {}),
                }),
            });

            if (!res.ok) {
                const data = await res.json() as { error?: string };
                throw new Error(data.error || "Wystąpił błąd podczas generowania");
            }

            const data = await res.json() as { url: string };
            setResultUrl(data.url);

            try {
                const assetKey = extractR2KeyFromReference(data.url) ?? data.url;
                const assetName = assetKey.split("/").pop() || "generated-image.jpg";

                await assetService.saveAsset(
                    user.uid,
                    {
                        id: assetKey,
                        url: data.url,
                        name: assetName,
                        size: 0,
                    },
                    "generated",
                    { generationPrompt: prompt.trim() }
                );

                setMaterialSaveStatus("saved");
                setMaterialSaveMessage("Zdjęcie zostało zapisane w materiałach.");
            } catch (materialError) {
                console.error("Failed to save generated image to materials:", materialError);
                setMaterialSaveStatus("failed");
                setMaterialSaveMessage("Zdjęcie wygenerowano, ale nie udało się zapisać go w materiałach.");
            }

            if (isEditMode && effectiveSourceSessionId) {
                try {
                    await sessionService.appendResults(effectiveSourceSessionId, [data.url]);
                    setSessionSaveStatus("saved");
                    setSessionSaveMessage("Nowe zdjęcie zostało automatycznie dodane do sesji źródłowej.");
                } catch (sessionError) {
                    console.error("Failed to attach edited image to source session:", sessionError);
                    setSessionSaveStatus("failed");
                    setSessionSaveMessage("Zdjęcie wygenerowano, ale nie udało się dopisać go do sesji źródłowej.");
                }
            } else if (isEditMode) {
                setSessionSaveStatus("failed");
                setSessionSaveMessage("Zdjęcie wygenerowano, ale nie udało się ustalić sesji źródłowej.");
            }
        } catch (err: unknown) {
            console.error("Failed to generate custom image:", err);
            let message = err instanceof Error ? err.message : "Błąd generowania";

            if (didChargeCredits) {
                try {
                    await userService.refundCredits(user.uid, CUSTOM_GENERATION_COST);
                    message = `${message} Punkty zostały automatycznie zwrócone.`;
                } catch (refundError) {
                    console.error("Failed to refund credits after custom generation error:", refundError);
                    message = `${message} Nie udało się automatycznie zwrócić ${CUSTOM_GENERATION_COST} PKT.`;
                }
            }

            setError(message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
            <AppHeader user={user} userProfile={userProfile} loading={loading} onLogout={logout} sticky />
            <div className="mx-auto max-w-4xl space-y-8 py-10 px-4">
                <div className="text-center space-y-4 mb-12">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                        <Sparkles className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">
                        {isEditMode ? "Edycja pojedynczego zdjęcia" : "Generator pojedynczego zdjęcia"}
                    </h1>
                        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                            {isEditMode
                                ? <>Zaznacz maską fragment do zmiany i opisz, co ma zostać poprawione.</>
                                : <>Opisz scenę i wygeneruj pojedyncze zdjęcie.</>
                            }
                        </p>
                </div>

                <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl relative">
                    <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-30" />
                    <CardContent className="p-8 space-y-8">

                        <div className="space-y-4">
                            <PhotoUploader
                                title="Zdjęcia referencyjne (opcjonalnie)"
                                description="Dodaj zdjęcia twarzy, postaci lub stylu, na których ma bazować wygenerowany obraz. Maksymalnie 5 zdjęć."
                                assets={assets}
                                onUpload={addAsset}
                                onRemove={removeAsset}
                                maxFiles={5}
                                userId={userId}
                                assetType="face"
                                galleryTypes={["face", "generated"]}
                            />
                            {restoredDraftMessage ? (
                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                                    {restoredDraftMessage}
                                </div>
                            ) : null}
                        </div>

                        {isEditMode && (
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-zinc-300 ml-1">
                                    Obszar edycji (maska)
                                </label>
                                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-4">
                                    <p className="text-sm text-zinc-400">
                                        Zamaluj na czerwono tylko ten fragment, który chcesz zmienić. Niezamalowana część zdjęcia powinna zostać zachowana.
                                    </p>
                                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/60 aspect-[5/4] relative">
                                        {resolvedEditImageUrl ? (
                                            <>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    ref={baseImageRef}
                                                    src={resolvedEditImageUrl}
                                                    alt="Zdjęcie do edycji"
                                                    className="absolute inset-0 h-full w-full object-contain select-none"
                                                    draggable={false}
                                                    onLoad={initializeMaskCanvas}
                                                    onError={() => {
                                                        setImageError("Nie udało się wyświetlić zdjęcia do edycji.");
                                                        setMaskReady(false);
                                                    }}
                                                />
                                                <canvas
                                                    ref={overlayCanvasRef}
                                                    className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
                                                    onPointerDown={handleMaskPointerDown}
                                                    onPointerMove={handleMaskPointerMove}
                                                    onPointerUp={() => setIsPainting(false)}
                                                    onPointerLeave={() => setIsPainting(false)}
                                                />
                                            </>
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-zinc-400 text-center">
                                                {isResolvingEditImage
                                                    ? "Ładowanie zdjęcia do edycji..."
                                                    : (imageError || "Brak zdjęcia do edycji. Wejdź tutaj przez akcję Edytuj w sesji.")}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div className="space-y-2 md:max-w-sm w-full">
                                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                                <span className="inline-flex items-center gap-1">
                                                    <PencilLine className="h-3.5 w-3.5" /> Rozmiar pędzla
                                                </span>
                                                <span>{brushSize}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={12}
                                                max={140}
                                                step={1}
                                                value={brushSize}
                                                onChange={(event) => setBrushSize(Number(event.target.value))}
                                                className="w-full accent-blue-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs ${hasMask ? "text-emerald-400" : "text-zinc-500"}`}>
                                                {hasMask ? "Maska gotowa" : "Maska pusta"}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                                                onClick={clearMask}
                                                disabled={!maskReady || !hasMask}
                                            >
                                                <RotateCcw className="mr-2 h-4 w-4" /> Wyczyść maskę
                                            </Button>
                                        </div>
                                    </div>
                                    <canvas ref={maskCanvasRef} className="hidden" />
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <label htmlFor="prompt" className="text-sm font-medium text-zinc-300 ml-1">
                                {isEditMode ? "Instrukcja edycji" : "Twój Prompt"}
                            </label>
                            <Textarea
                                id="prompt"
                                placeholder={isEditMode
                                    ? "np. Usuń czerwony kubek i zastąp go zamkniętym laptopem, zachowaj to samo oświetlenie."
                                    : "np. Portret w stylu cyberpunkowym, neony, nocne miasto w deszczu, 85mm f/1.4..."}
                                className="min-h-[120px] bg-black/40 border-white/10 focus-visible:ring-blue-500/50 text-base text-white placeholder:text-zinc-500 resize-y"
                                value={prompt}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                disabled={isGenerating}
                            />
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <div className="text-xs text-zinc-500">
                                Koszt: <span className="text-zinc-300 font-medium">{CUSTOM_GENERATION_COST} PKT</span>
                            </div>
                            <Button
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-500 text-white min-w-[200px]"
                                disabled={
                                    !prompt.trim() ||
                                    isGenerating ||
                                    (isEditMode && (!maskReady || !hasMask || !resolvedEditImageUrl)) ||
                                    !hasEnoughCredits
                                }
                                onClick={handleGenerate}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {isEditMode ? "Edytowanie..." : "Generowanie..."}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-5 w-5" />
                                        {isEditMode ? "Edytuj Zdjęcie" : "Generuj Zdjęcie"}
                                    </>
                                )}
                            </Button>
                        </div>

                        {!hasEnoughCredits ? (
                            <div className="text-right text-xs text-red-200">
                                Brakuje {missingCredits} PKT, aby uruchomić tę generację.
                            </div>
                        ) : null}

                        {error && (
                            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <AnimatePresence mode="wait">
                    {resultUrl && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-4"
                        >
                            <h3 className="text-xl font-semibold text-white px-2 flex items-center gap-2">
                                <ImageIcon className="h-5 w-5 text-blue-400" />
                                {isEditMode ? "Wynik Edycji" : "Wynik Generowania"}
                            </h3>
                            {materialSaveMessage ? (
                                <div
                                    className={
                                        materialSaveStatus === "saved"
                                            ? "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                                            : "rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                                    }
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span>{materialSaveMessage}</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                            asChild
                                        >
                                            <Link href="/materialy">Przejdź do materiałów</Link>
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                            {sessionSaveMessage ? (
                                <div
                                    className={
                                        sessionSaveStatus === "saved"
                                            ? "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                                            : "rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                                    }
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span>{sessionSaveMessage}</span>
                                        {resolvedSourceSessionId ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                                asChild
                                            >
                                                <Link href={`/sesje/${resolvedSourceSessionId}`}>Przejdź do sesji</Link>
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/50 aspect-[3/2] relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={resultUrl}
                                    alt={isEditMode ? "Edytowane zdjęcie" : "Wygenerowane zdjęcie"}
                                    className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
                                    <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-md" asChild>
                                        <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                                            Pełny rozmiar
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function CustomGeneratorPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                </div>
            }
        >
            <CustomGeneratorContent />
        </Suspense>
    );
}
