"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession } from "@/lib/sessions";
import { Camera, Calendar, ArrowLeft, Loader2, Download, ExternalLink, ImageIcon, PencilLine, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PhotoUploader } from "@/components/photo-uploader";
import type { PhotoAsset } from "@/lib/store";
import { referenceUrlToPhotoAsset } from "@/lib/reference-assets";
import { ImageWithPlaceholder } from "@/components/image-with-placeholder";

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [session, setSession] = useState<Photosession | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingReferences, setIsEditingReferences] = useState(false);
    const [isSavingReferences, setIsSavingReferences] = useState(false);
    const [faceReferencesDraft, setFaceReferencesDraft] = useState<PhotoAsset[]>([]);
    const [officeReferencesDraft, setOfficeReferencesDraft] = useState<PhotoAsset[]>([]);
    const [outfitReferencesDraft, setOutfitReferencesDraft] = useState<PhotoAsset[]>([]);
    const [customPromptDraft, setCustomPromptDraft] = useState("");
    const [requestedCountDraft, setRequestedCountDraft] = useState(4);
    const [isSyncingResults, setIsSyncingResults] = useState(false);

    useEffect(() => {
        if (!session?.id || !user || session.results.length > 0 || session.status === "failed") {
            return;
        }
        const activeSessionId = session.id;

        let cancelled = false;

        const syncSessionFromWorkflow = async () => {
            if (cancelled) return;
            setIsSyncingResults(true);
            try {
                const response = await fetch(
                    `/api/status?instanceId=${encodeURIComponent(activeSessionId)}`,
                    { cache: "no-store" }
                );
                if (!response.ok) return;

                const data = await response.json() as {
                    status: "queued" | "running" | "complete" | "errored" | "terminated";
                    output?: { resultUrls?: string[] };
                };
                if (cancelled) return;

                const workflowResults = data.output?.resultUrls ?? [];
                if (workflowResults.length > 0) {
                    const mergedResults = Array.from(new Set([...(session.results || []), ...workflowResults]));
                    const targetStatus = data.status === "complete" ? "completed" : "processing";
                    const hasNewResults = mergedResults.length !== session.results.length;
                    const statusChanged = session.status !== targetStatus;

                    if (hasNewResults || statusChanged) {
                        await sessionService.updateSession(activeSessionId, {
                            status: targetStatus,
                            results: mergedResults,
                        });

                        if (!cancelled) {
                            setSession((prev) => {
                                if (!prev) return prev;
                                return { ...prev, status: targetStatus, results: mergedResults };
                            });
                        }
                    }
                    if (data.status === "complete") return;
                }

                if (data.status === "errored" || data.status === "terminated") {
                    await sessionService.updateSession(activeSessionId, { status: "failed" });
                    if (!cancelled) {
                        setSession((prev) => (prev ? { ...prev, status: "failed" } : prev));
                    }
                }
            } catch (error) {
                console.warn("Workflow sync failed:", error);
            } finally {
                if (!cancelled) {
                    setIsSyncingResults(false);
                }
            }
        };

        void syncSessionFromWorkflow();
        const interval = setInterval(() => {
            void syncSessionFromWorkflow();
        }, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [session?.id, session?.status, session?.results, user]);

    const resetReferenceDraft = useCallback((sessionData: Photosession) => {
        setFaceReferencesDraft(
            sessionData.faceReferences.map((reference, index) => referenceUrlToPhotoAsset(reference, index, "face"))
        );
        setOfficeReferencesDraft(
            sessionData.officeReferences.slice(0, 1).map((reference, index) => referenceUrlToPhotoAsset(reference, index, "office"))
        );
        setOutfitReferencesDraft(
            sessionData.outfitReferences.map((reference, index) => referenceUrlToPhotoAsset(reference, index, "outfit"))
        );
        setCustomPromptDraft(sessionData.customPrompt);
        setRequestedCountDraft(sessionData.requestedCount);
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/login?callbackUrl=/sesje/${sessionId}`);
            return;
        }

        if (user && sessionId) {
            const fetchSession = async () => {
                try {
                    const data = await sessionService.getSessionById(sessionId);
                    if (!data || data.userId !== user.uid) {
                        router.push(`/sesje`);
                        return;
                    }
                    setSession(data);
                    resetReferenceDraft(data);
                } catch (error) {
                    console.error("Error fetching session:", error);
                    router.push(`/sesje`);
                } finally {
                    setLoading(false);
                }
            };
            fetchSession();
        }
    }, [user, authLoading, router, sessionId, resetReferenceDraft]);

    const handleSaveReferences = async () => {
        if (!session?.id) return;

        if (faceReferencesDraft.length === 0) {
            alert("Dodaj przynajmniej jedno zdjęcie wizerunkowe.");
            return;
        }

        if (officeReferencesDraft.length === 0) {
            alert("Wybierz jedną lokację biurową.");
            return;
        }

        const updatedFaceReferences = faceReferencesDraft.map((asset) => asset.url);
        const updatedOfficeReferences = officeReferencesDraft.slice(0, 1).map((asset) => asset.url);
        const updatedOutfitReferences = outfitReferencesDraft.map((asset) => asset.url);
        const updatedCustomPrompt = customPromptDraft.trim();

        setIsSavingReferences(true);
        try {
            await sessionService.updateSession(session.id, {
                faceReferences: updatedFaceReferences,
                officeReferences: updatedOfficeReferences,
                outfitReferences: updatedOutfitReferences,
                customPrompt: updatedCustomPrompt,
                requestedCount: requestedCountDraft,
            });

            setSession((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    faceReferences: updatedFaceReferences,
                    officeReferences: updatedOfficeReferences,
                    outfitReferences: updatedOutfitReferences,
                    customPrompt: updatedCustomPrompt,
                    requestedCount: requestedCountDraft,
                };
            });

            setIsEditingReferences(false);
        } catch (error) {
            console.error("Error updating references:", error);
            alert("Nie udało się zapisać zmian materiałów. Spróbuj ponownie.");
        } finally {
            setIsSavingReferences(false);
        }
    };

    const handleDownload = async (url: string, index: number) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `sesja-${session?.id}-photo-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Error downloading image:", error);
            // Fallback opening in new tab
            window.open(url, "_blank");
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!session || !user) return null;

    const noResultsTitle =
        session.status === "failed"
            ? "Generowanie zakończone błędem"
            : session.status === "completed"
                ? "Workflow zakończony, trwa synchronizacja wyników"
                : "Sesja w trakcie generowania";
    const noResultsDescription =
        session.status === "failed"
            ? "Nie udało się pobrać wyników z workflow. Uruchom kontynuację sesji ponownie."
            : isSyncingResults
                ? "Sprawdzamy workflow i pobieramy gotowe zdjęcia do tej sesji..."
                : "To może potrwać kilka minut. Odśwież stronę za moment, aby sprawdzić wyniki.";

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans pb-20">
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto flex h-16 items-center px-6">
                    <Link href={`/sesje`}>
                        <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-4 mr-4">
                            <ArrowLeft className="mr-2 h-4 w-4" /> wszystkie sesje
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Camera className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Szczegóły Sesji</span>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border",
                                session.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            )}>
                                {session.status === 'completed' ? 'Ukończono' : session.status}
                            </span>
                            <div className="text-sm text-zinc-400 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {session.createdAt?.toDate().toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })}
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Twoja sesja biznesowa</h1>
                        <p className="text-zinc-500 text-sm mt-1 font-mono">ID: {session.id}</p>
                    </div>
                    <div className="flex-shrink-0">
                        <Link href={`/generator?sessionId=${session.id}`}>
                            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20">
                                Kontynuuj sesję (+{session.requestedCount} zdjęć)
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Results Column (Takes up 2/3 on desktop) */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-blue-400" />
                            Wygenerowane Fotografie
                        </h2>

                        {session.results.length === 0 ? (
                            <Card className="border-white/10 bg-white/5 backdrop-blur-xl border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                    {session.status !== "failed" ? (
                                        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                                    ) : (
                                        <ImageIcon className="h-10 w-10 text-zinc-500 mb-4" />
                                    )}
                                    <h3 className="text-lg font-medium text-white">{noResultsTitle}</h3>
                                    <p className="text-zinc-400 max-w-sm mt-2">{noResultsDescription}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {session.results.map((url, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[3/4]"
                                    >
                                        <ImageWithPlaceholder
                                            src={url}
                                            alt={`Generated shot ${i + 1}`}
                                            className="w-full h-full object-cover"
                                            fallbackLabel="Zdjęcie niedostępne"
                                        />

                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                            <div className="flex gap-2 w-full">
                                                <Button
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/50"
                                                    onClick={() => handleDownload(url, i)}
                                                >
                                                    <Download className="mr-2 h-4 w-4" /> Pobierz HD
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
                                                    onClick={() => window.open(url, "_blank")}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Reference Column */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">Użyte materiały</h2>
                            {!isEditingReferences ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                    onClick={() => {
                                        resetReferenceDraft(session);
                                        setIsEditingReferences(true);
                                    }}
                                >
                                    <PencilLine className="mr-2 h-4 w-4" /> Wymień materiały
                                </Button>
                            ) : null}
                        </div>
                        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                            <CardContent className="p-6 space-y-8">
                                {isEditingReferences ? (
                                    <>
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                                            Możesz podmienić materiały i kontynuować tę samą sesję. Lokacja biurowa jest ograniczona do 1 zdjęcia, żeby uniknąć miksowania pomieszczeń.
                                        </div>

                                        <PhotoUploader
                                            title="Zdjęcia Wizerunkowe"
                                            description="Wymień zdjęcia twarzy/postaci, które mają być użyte przy kolejnych dogenerowaniach."
                                            assets={faceReferencesDraft}
                                            onUpload={(asset) => setFaceReferencesDraft((prev) => [...prev, asset])}
                                            onRemove={(id) => setFaceReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={10}
                                            userId={user.uid}
                                            assetType="face"
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <PhotoUploader
                                            title="Lokacja Biurowa"
                                            description="Wybierz jedną lokację biurową dla kolejnych ujęć tej sesji."
                                            assets={officeReferencesDraft}
                                            onUpload={(asset) => setOfficeReferencesDraft([asset])}
                                            onRemove={(id) => setOfficeReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={1}
                                            userId={user.uid}
                                            assetType="office"
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <PhotoUploader
                                            title="Referencje Ubioru (opcjonalnie)"
                                            description="Dodaj ubrania/stylizacje, aby utrzymać spójny dress code przy kontynuacji sesji."
                                            assets={outfitReferencesDraft}
                                            onUpload={(asset) => setOutfitReferencesDraft((prev) => [...prev, asset])}
                                            onRemove={(id) => setOutfitReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={6}
                                            userId={user.uid}
                                            assetType="outfit"
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                                    Liczba zdjęć w kolejnej kontynuacji
                                                </label>
                                                <Select
                                                    value={String(requestedCountDraft)}
                                                    onValueChange={(value) => setRequestedCountDraft(Number(value))}
                                                >
                                                    <SelectTrigger className="h-11 border-white/10 bg-white/5 text-white">
                                                        <SelectValue placeholder="Wybierz liczbę zdjęć" />
                                                    </SelectTrigger>
                                                    <SelectContent className="border-white/10 bg-[#0f172a] text-white">
                                                        {["1", "2", "3", "4", "5"].map((value) => (
                                                            <SelectItem key={value} value={value}>
                                                                {value} zdjęć
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="session-prompt-draft" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                                    Prompt tekstowy (opcjonalnie)
                                                </label>
                                                <Textarea
                                                    id="session-prompt-draft"
                                                    value={customPromptDraft}
                                                    onChange={(e) => setCustomPromptDraft(e.target.value)}
                                                    placeholder="Np. osoba stojąca bokiem, formalna koszula, naturalny newsroom look."
                                                    className="min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                className="text-zinc-300 hover:bg-white/5 hover:text-white"
                                                onClick={() => {
                                                    resetReferenceDraft(session);
                                                    setIsEditingReferences(false);
                                                }}
                                            >
                                                <X className="mr-2 h-4 w-4" /> Anuluj
                                            </Button>
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={handleSaveReferences}
                                                disabled={isSavingReferences}
                                            >
                                                {isSavingReferences ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Zapisz materiały
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-medium text-zinc-300">Zdjęcia Wizerunkowe</span>
                                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.faceReferences.length}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {session.faceReferences.map((url, i) => (
                                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                        <ImageWithPlaceholder
                                                            src={url}
                                                            className="w-full h-full object-cover"
                                                            alt="Face ref"
                                                            fallbackLabel="Zdjęcie usunięte"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-medium text-zinc-300">Lokacje Biurowe</span>
                                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.officeReferences.length}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {session.officeReferences.map((url, i) => (
                                                    <div key={i} className="aspect-video rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                        <ImageWithPlaceholder
                                                            src={url}
                                                            className="w-full h-full object-cover"
                                                            alt="Office ref"
                                                            fallbackLabel="Zdjęcie usunięte"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-medium text-zinc-300">Referencje Ubioru</span>
                                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.outfitReferences.length}</span>
                                            </div>
                                            {session.outfitReferences.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {session.outfitReferences.map((url, i) => (
                                                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                            <ImageWithPlaceholder
                                                                src={url}
                                                                className="w-full h-full object-cover"
                                                                alt="Outfit ref"
                                                                fallbackLabel="Zdjęcie usunięte"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zinc-500">Brak referencji ubioru. Możesz je dodać w trybie edycji.</p>
                                            )}
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs uppercase tracking-wide text-zinc-500">Parametry kolejnej kontynuacji</div>
                                            <div className="text-sm text-zinc-300">
                                                Liczba zdjęć: <span className="font-medium text-white">{session.requestedCount}</span>
                                            </div>
                                            <div className="text-sm text-zinc-300">
                                                Prompt:{" "}
                                                <span className="text-white">
                                                    {session.customPrompt ? session.customPrompt : "brak (użyty zostanie prompt bazowy)"}
                                                </span>
                                            </div>
                                        </div>

                                        {session.officeReferences.length > 1 ? (
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                                                W tej sesji zapisano wiele lokacji biurowych. Przy kolejnych generacjach zalecamy zostawić tylko jedną, żeby uniknąć mieszania tła.
                                            </div>
                                        ) : null}

                                        <Link href={`/generator?sessionId=${session.id}`}>
                                            <Button
                                                variant="outline"
                                                className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                            >
                                                Kontynuuj tę sesję (+{session.requestedCount} zdjęć)
                                            </Button>
                                        </Link>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
