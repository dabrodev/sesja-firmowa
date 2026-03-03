"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, Sparkles, ChevronRight, ChevronLeft, CheckCircle2, Coins } from "lucide-react";
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
import { useAppStore } from "@/lib/store";
import { PhotoUploader } from "@/components/photo-uploader";
import { GenerationResults } from "@/components/generation-results";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession, PromptRunTrace } from "@/lib/sessions";
import { userService } from "@/lib/users";
import { cn } from "@/lib/utils";
import { CopyPlus } from "lucide-react";
import { referenceUrlToPhotoAsset } from "@/lib/reference-assets";
import Link from "next/link";

type WizardStepId = "face" | "office" | "generate";
const COST_PER_PHOTO = 30;

function getReadableError(error: unknown, fallback: string): string {
    if (!error) return fallback;
    if (error instanceof Error) return error.message || fallback;

    if (typeof error === "string") {
        const trimmed = error.trim();
        if (!trimmed) return fallback;
        try {
            const parsed = JSON.parse(trimmed) as { message?: unknown; error?: unknown };
            if (typeof parsed.message === "string" && parsed.message.trim()) {
                return parsed.message;
            }
            if (typeof parsed.error === "string" && parsed.error.trim()) {
                return parsed.error;
            }
        } catch {
            // fallback to raw string
        }
        return trimmed;
    }

    if (typeof error === "object") {
        const candidate = error as { message?: unknown; error?: unknown };
        if (typeof candidate.message === "string" && candidate.message.trim()) {
            return candidate.message;
        }
        if (typeof candidate.error === "string" && candidate.error.trim()) {
            return candidate.error;
        }
        try {
            return JSON.stringify(error);
        } catch {
            return fallback;
        }
    }

    return fallback;
}

export function SessionWizard({ sessionId: initialSessionId, onNewSessionRequested }: { sessionId?: string, onNewSessionRequested?: () => void }) {
    const [step, setStep] = useState<WizardStepId>("face");
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
    const [resultUrls, setResultUrls] = useState<string[]>([]);
    const [generationStatus, setGenerationStatus] = useState<string>("Inicjalizuję...");
    const [sessionData, setSessionData] = useState<Photosession | null>(null);
    const [customPrompt, setCustomPrompt] = useState("");
    const [requestedCount, setRequestedCount] = useState(4);
    const { user, userProfile } = useAuth();
    const {
        currentPersona,
        currentOffice,
        currentOutfit,
        addFaceReference,
        removeFaceReference,
        addOfficeReference,
        removeOfficeReference,
        addOutfitReference,
        removeOutfitReference,
        setPersona,
        setOffice,
        setOutfit
    } = useAppStore();

    useEffect(() => {
        if (initialSessionId) {
            setSessionId(initialSessionId);
            sessionService.getSessionById(initialSessionId).then(data => {
                if (!data) return;

                setSessionData(data);

                const sessionFaceAssets = data.faceReferences.map((reference, index) =>
                    referenceUrlToPhotoAsset(reference, index, "face")
                );
                const sessionOfficeAssets = data.officeReferences.slice(0, 1).map((reference, index) =>
                    referenceUrlToPhotoAsset(reference, index, "office")
                );
                const sessionOutfitAssets = data.outfitReferences.map((reference, index) =>
                    referenceUrlToPhotoAsset(reference, index, "outfit")
                );

                setPersona({
                    id: "default-persona",
                    name: "My Profile",
                    faceReferences: sessionFaceAssets,
                });
                setOffice({
                    id: "default-office",
                    name: "Main Office",
                    officeReferences: sessionOfficeAssets,
                });
                setOutfit({
                    id: "default-outfit",
                    name: "Outfit References",
                    outfitReferences: sessionOutfitAssets,
                });
                setCustomPrompt(data.customPrompt);
                setRequestedCount(data.requestedCount);
            });
        } else {
            setSessionId(null);
            setSessionData(null);
            setCustomPrompt("");
            setRequestedCount(4);
        }
    }, [initialSessionId, setOffice, setOutfit, setPersona]);

    const faceAssets = currentPersona?.faceReferences || [];
    const officeAssets = currentOffice?.officeReferences || [];
    const outfitAssets = currentOutfit?.outfitReferences || [];

    const steps: { id: WizardStepId; label: string; icon: React.ReactNode; completed: boolean }[] = [
        { id: "face", label: "Wizerunek", icon: <User className="h-4 w-4" />, completed: faceAssets.length >= 1 },
        { id: "office", label: "Biuro i styl", icon: <Building2 className="h-4 w-4" />, completed: officeAssets.length >= 1 },
        { id: "generate", label: "Generuj", icon: <Sparkles className="h-4 w-4" />, completed: hasCompleted }
    ];
    const totalCost = requestedCount * COST_PER_PHOTO;
    const availableCredits = userProfile?.credits ?? 0;
    const missingCredits = Math.max(0, totalCost - availableCredits);
    const hasKnownCredits = typeof userProfile?.credits === "number";
    const hasEnoughCredits = hasKnownCredits && availableCredits >= totalCost;

    if (!user) {
        return null;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-8 py-12 px-4">
            {/* Wizard Progress */}
            <div className="flex items-center justify-center gap-4 mb-12">
                {steps.map((s, i) => (
                    <React.Fragment key={s.id}>
                        <WizardStep
                            active={step === s.id}
                            completed={s.completed}
                            icon={s.icon}
                            label={s.label}
                            onClick={() => {
                                const prevCompleted = i === 0 || steps[i - 1].completed;
                                if (prevCompleted || step === s.id) setStep(s.id);
                            }}
                        />
                        {i < steps.length - 1 && (
                            <div className={cn(
                                "h-px w-12 transition-all duration-700",
                                s.completed ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-white/10"
                            )} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl relative">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-30" />
                <CardContent className="p-8">
                    <AnimatePresence mode="wait">
                        {step === "face" && (
                            <motion.div
                                key="face-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <PhotoUploader
                                    title="Twoje zdjęcie referencyjne"
                                    description="Wgraj minimum 1 wyraźne zdjęcie swojej twarzy. Im więcej zdjęć (maks 10), tym lepiej AI nauczy się Twoich rysów i idealnie dopasuje je do sesji."
                                    assets={faceAssets}
                                    onUpload={addFaceReference}
                                    onRemove={removeFaceReference}
                                    maxFiles={10}
                                    userId={user.uid}
                                    assetType="face"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        disabled={faceAssets.length < 1}
                                        onClick={() => setStep("office")}
                                        className="bg-blue-600 hover:bg-blue-700 h-12 px-8 shadow-lg shadow-blue-500/20"
                                    >
                                        dalej: biuro i ubiór <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === "office" && (
                            <motion.div
                                key="office-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <PhotoUploader
                                    title="Twoje lokalizacje"
                                    description="Wgraj jedno zdjęcie biura lub wybierz jedno z naszych wnętrz. Używamy jednej lokacji, aby uniknąć miksowania pomieszczeń."
                                    assets={officeAssets}
                                    onUpload={addOfficeReference}
                                    onRemove={removeOfficeReference}
                                    maxFiles={1}
                                    userId={user.uid}
                                    assetType="office"
                                />
                                <PhotoUploader
                                    title="Referencje ubioru (opcjonalnie)"
                                    description="Dodaj zdjęcia ubrań lub stylizacji (np. koszula, spodnie, spódnica), aby AI trzymało spójny dress code."
                                    assets={outfitAssets}
                                    onUpload={addOutfitReference}
                                    onRemove={removeOutfitReference}
                                    maxFiles={6}
                                    userId={user.uid}
                                    assetType="outfit"
                                />
                                <div className="flex justify-between">
                                    <Button variant="ghost" onClick={() => setStep("face")} className="text-zinc-400 hover:bg-white/5">
                                        <ChevronLeft className="mr-2 h-4 w-4" /> Wróć do zdjęć twarzy
                                    </Button>
                                    <Button
                                        disabled={officeAssets.length < 1}
                                        onClick={() => setStep("generate")}
                                        className="bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 h-12 px-8 shadow-lg shadow-blue-500/20 text-white border border-white/10"
                                    >
                                        dalej: prompt i start <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === "generate" && (
                            <motion.div
                                key="generate-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                {!isGenerating && !hasCompleted ? (
                                    <div className="text-center space-y-8 py-12">
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        >
                                            <Sparkles className="h-10 w-10 animate-pulse" />
                                        </motion.div>
                                        <div>
                                            <h2 className="text-3xl font-bold text-white tracking-tight">
                                                {sessionData ? "Kontynuuj wskazaną sesję" : "Gotowy na nową sesję?"}
                                            </h2>
                                            <p className="mx-auto mt-4 max-w-md text-zinc-400 leading-relaxed">
                                                {sessionData
                                                    ? `Kreator jest w trybie kontynuacji sesji "${sessionData.name}". Wskaż ile nowych ujęć dodać oraz opcjonalny prompt tekstowy.`
                                                    : "Wszystkie dane zostały przygotowane. System AI przeanalizuje twoje rysy i stworzy fotorealistyczną sesję w wybranych wnętrzach."}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                            <div className="rounded-2xl bg-white/5 p-5 border border-white/10 text-left hover:border-blue-500/30 transition-all group">
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 group-hover:text-blue-400 transition-colors">Postać</span>
                                                <div className="mt-1 text-lg font-medium text-white">{faceAssets.length} zdjęć referencyjnych</div>
                                            </div>
                                            <div className="rounded-2xl bg-white/5 p-5 border border-white/10 text-left hover:border-blue-500/30 transition-all group">
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 group-hover:text-blue-400 transition-colors">Otoczenie</span>
                                                <div className="mt-1 text-lg font-medium text-white">{officeAssets.length} lokalizacji biurowej</div>
                                            </div>
                                            <div className="rounded-2xl bg-white/5 p-5 border border-white/10 text-left hover:border-blue-500/30 transition-all group">
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 group-hover:text-blue-400 transition-colors">Ubiór</span>
                                                <div className="mt-1 text-lg font-medium text-white">{outfitAssets.length} referencji stylu</div>
                                            </div>
                                        </div>

                                        <div className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-left">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                                        Liczba zdjęć
                                                    </label>
                                                    <Select
                                                        value={String(requestedCount)}
                                                        onValueChange={(value) => setRequestedCount(Number(value))}
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
                                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm">
                                                    <div className="text-zinc-300">Koszt tej generacji</div>
                                                    <div className="mt-1 text-2xl font-semibold text-white">{totalCost} PKT</div>
                                                    <div className="text-xs text-zinc-400">{COST_PER_PHOTO} PKT za każde zdjęcie</div>
                                                </div>
                                            </div>
                                            <div
                                                className={cn(
                                                    "rounded-xl border px-4 py-3 text-sm",
                                                    hasEnoughCredits
                                                        ? "border-emerald-500/20 bg-emerald-500/10"
                                                        : "border-red-500/20 bg-red-500/10"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 text-zinc-200">
                                                    <Coins className="h-4 w-4" />
                                                    <span>
                                                        Twoje saldo: <span className="font-semibold text-white">{availableCredits} PKT</span>
                                                    </span>
                                                </div>
                                                {hasEnoughCredits ? (
                                                    <p className="mt-1 text-xs text-emerald-200">
                                                        Masz wystarczającą liczbę punktów, możesz uruchomić generowanie.
                                                    </p>
                                                ) : (
                                                    <>
                                                        <p className="mt-1 text-xs text-red-200">
                                                            Brak punktów. Brakuje <span className="font-semibold text-white">{missingCredits} PKT</span> do tej generacji.
                                                        </p>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <Link href="/kredyty">
                                                                <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white">
                                                                    Doładuj kredyty
                                                                </Button>
                                                            </Link>
                                                            <Link href="/wolny-generator">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                                                >
                                                                    Użyj wolnego generatora
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="session-custom-prompt" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                                    Prompt tekstowy (opcjonalnie)
                                                </label>
                                                <Textarea
                                                    id="session-custom-prompt"
                                                    value={customPrompt}
                                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                                    placeholder="Np. osoba pracująca przy biurku, spokojny wyraz twarzy, formalna koszula, styl editorial."
                                                    className="min-h-[110px] border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                                                />
                                                <p className="text-xs text-zinc-500">
                                                    Jeśli podasz prompt, ma najwyższy priorytet dla kadru/pozy/stylu. Gdy pole jest puste, użyjemy domyślnego stylu biznesowego.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-4 pt-4">
                                            <Button
                                                size="lg"
                                                disabled={isGenerating || !hasEnoughCredits}
                                                onClick={async () => {
                                                    if (!user) return;
                                                    if (!hasEnoughCredits) return;
                                                    const cost = requestedCount * COST_PER_PHOTO;

                                                    setIsGenerating(true);
                                                    setHasCompleted(false);
                                                    setResultUrls([]);
                                                    setGenerationStatus("Inicjalizuję sesję...");

                                                    let activeSessionId: string | null = sessionId;
                                                    try {
                                                        const trimmedPrompt = customPrompt.trim();
                                                        const sessionUpdatePayload = {
                                                            faceReferences: faceAssets.map((a) => a.url),
                                                            officeReferences: officeAssets.slice(0, 1).map((a) => a.url),
                                                            outfitReferences: outfitAssets.map((a) => a.url),
                                                            customPrompt: trimmedPrompt,
                                                            requestedCount,
                                                            status: "processing" as const,
                                                            activeWorkflowInstanceId: null,
                                                            activeWorkflowRunId: null,
                                                        };

                                                        if (!activeSessionId) {
                                                            activeSessionId = await sessionService.saveSession(user.uid, {
                                                                ...sessionUpdatePayload,
                                                                results: [],
                                                                name: "" // backend will auto-assign "Sesja X (Data)"
                                                            });
                                                            setSessionId(activeSessionId);
                                                        } else {
                                                            await sessionService.updateSession(activeSessionId, sessionUpdatePayload);
                                                        }
                                                        if (!activeSessionId) {
                                                            throw new Error("Nie udało się zapisać sesji.");
                                                        }
                                                        const persistedSessionId = activeSessionId;

                                                        await userService.deductCredits(user.uid, cost);

                                                        setGenerationStatus("Uruchamiam workflow...");
                                                        const runId = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
                                                        const resp = await fetch("/api/generate", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                sessionId: persistedSessionId,
                                                                uid: user.uid,
                                                                faceKeys: faceAssets.map((a) => a.id),
                                                                officeKeys: officeAssets.slice(0, 1).map((a) => a.id),
                                                                outfitKeys: outfitAssets.map((a) => a.id),
                                                                customPrompt: trimmedPrompt,
                                                                requestedCount,
                                                                runId,
                                                            })
                                                        });

                                                        if (!resp.ok) {
                                                            const err = await resp.json() as { error?: string };
                                                            throw new Error(err.error || "Nie udało się uruchomić generowania");
                                                        }

                                                        const { instanceId } = await resp.json() as { instanceId: string };
                                                        await sessionService.updateSession(persistedSessionId, {
                                                            activeWorkflowInstanceId: instanceId,
                                                            activeWorkflowRunId: runId,
                                                        });
                                                        setGenerationStatus("Analizuję zdjęcia referencyjne...");
                                                        let attempts = 0;
                                                        const maxAttempts = 120;

                                                        await new Promise<void>((resolve, reject) => {
                                                            const poll = setInterval(async () => {
                                                                attempts++;
                                                                try {
                                                                    const sr = await fetch(
                                                                        `/api/status?instanceId=${encodeURIComponent(instanceId)}&runId=${encodeURIComponent(runId)}&sessionId=${encodeURIComponent(persistedSessionId)}`
                                                                    );
                                                                    const data = await sr.json() as {
                                                                        status: string;
                                                                        output?: { resultUrls?: string[]; promptDebug?: PromptRunTrace };
                                                                        error?: unknown;
                                                                    };

                                                                    if (attempts < 5) {
                                                                        setGenerationStatus("Generuję opis fotograficzny...");
                                                                    } else {
                                                                        const generatedCount = data.output?.resultUrls?.length ?? 0;
                                                                        const currentShot = Math.min(generatedCount + 1, requestedCount);
                                                                        setGenerationStatus(`Generuję fotografię ${currentShot}/${requestedCount}...`);
                                                                    }

                                                                    if (data.output?.resultUrls?.length) {
                                                                        const urls = data.output.resultUrls;
                                                                        setResultUrls(urls);
                                                                        if (!hasCompleted) {
                                                                            setHasCompleted(true);
                                                                        }
                                                                    }

                                                                    if (data.status === "complete") {
                                                                        clearInterval(poll);
                                                                        if (sessionId) {
                                                                            await sessionService.appendResults(persistedSessionId, data.output?.resultUrls || []);
                                                                            await sessionService.updateSession(persistedSessionId, {
                                                                                status: "completed",
                                                                                activeWorkflowInstanceId: null,
                                                                                activeWorkflowRunId: null,
                                                                            });
                                                                        } else {
                                                                            await sessionService.updateSession(persistedSessionId, {
                                                                                results: data.output?.resultUrls || [],
                                                                                status: "completed",
                                                                                activeWorkflowInstanceId: null,
                                                                                activeWorkflowRunId: null,
                                                                            });
                                                                        }
                                                                        if (data.output?.promptDebug) {
                                                                            await sessionService.upsertPromptRun(persistedSessionId, data.output.promptDebug);
                                                                        }
                                                                        setIsGenerating(false);
                                                                        resolve();
                                                                    } else if (data.status === "errored" || data.status === "terminated") {
                                                                        clearInterval(poll);
                                                                        const errStr = getReadableError(data.error, "Workflow zakończony błędem");
                                                                        setIsGenerating(false);
                                                                        reject(new Error(errStr || "Workflow zakończony błędem"));
                                                                    } else if (attempts >= maxAttempts) {
                                                                        clearInterval(poll);
                                                                        setIsGenerating(false);
                                                                        reject(new Error("Przekroczono czas oczekiwania"));
                                                                    }
                                                                } catch (e) { console.warn("Poll error:", e); }
                                                            }, 3000);
                                                        });

                                                    } catch (error: unknown) {
                                                        console.error("Failed to generate:", error);
                                                        if (activeSessionId) {
                                                            await sessionService.updateSession(activeSessionId, {
                                                                status: "failed",
                                                                activeWorkflowInstanceId: null,
                                                                activeWorkflowRunId: null,
                                                            });
                                                        }
                                                        alert("Błąd generowania: " + getReadableError(error, "Nieznany błąd"));
                                                        setIsGenerating(false);
                                                    }
                                                }}
                                                className="min-h-16 h-auto w-full max-w-sm px-6 py-4 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-base sm:text-lg font-bold shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 rounded-2xl text-white border border-white/10 whitespace-normal text-center leading-tight"
                                            >
                                                {isGenerating ? (
                                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
                                                ) : null}
                                                {sessionData ? `Kontynuuj sesję (+${requestedCount} zdjęć)` : `Utwórz nową sesję (+${requestedCount} zdjęć)`}
                                            </Button>

                                            {sessionData && onNewSessionRequested && (
                                                <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={onNewSessionRequested}>
                                                    <CopyPlus className="w-4 h-4 mr-2" />
                                                    Chcę utworzyć całkowicie nową sesję
                                                </Button>
                                            )}

                                            <p className="text-xs text-zinc-500">koszt: {totalCost} PKT za {requestedCount} fotografii AI</p>
                                            <Button variant="ghost" onClick={() => setStep("office")} className="text-zinc-500 hover:text-white transition-colors">
                                                <ChevronLeft className="mr-2 h-4 w-4" /> Wróć do edycji parametrów
                                            </Button>
                                        </div>
                                    </div>
                                ) : isGenerating ? (
                                    <div className="text-center space-y-10 py-24">
                                        <div className="relative mx-auto h-32 w-32">
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl"
                                            />
                                            <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl shadow-blue-500/50">
                                                <Sparkles className="h-14 w-14 text-white animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <h2 className="text-3xl font-bold text-white tracking-tight">Tworzymy twoją sesję...</h2>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-1 w-48 overflow-hidden rounded-full bg-white/5">
                                                    <motion.div
                                                        initial={{ x: "-100%" }}
                                                        animate={{ x: "100%" }}
                                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                        className="h-full w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                                                    />
                                                </div>
                                                <p className="text-zinc-500 text-sm animate-pulse tracking-wide uppercase">{generationStatus}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {hasCompleted && (
                                    <GenerationResults
                                        sessionId={sessionId}
                                        resultUrls={resultUrls}
                                        expectedCount={requestedCount}
                                    />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </div>
    );
}

function WizardStep({
    active,
    completed,
    icon,
    label,
    onClick
}: {
    active: boolean;
    completed: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "group relative flex flex-col items-center gap-3 transition-all duration-500 focus:outline-none",
                active ? "opacity-100 scale-105" : completed ? "opacity-80" : "opacity-40 hover:opacity-100"
            )}
        >
            <div
                className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-500",
                    active
                        ? "border-blue-500 bg-blue-600 text-white shadow-2xl shadow-blue-500/40"
                        : completed
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                            : "border-white/10 bg-white/5 text-zinc-500"
                )}
            >
                {completed ? <CheckCircle2 className="h-6 w-6" /> : icon}
            </div>
            <div className="flex flex-col items-center">
                <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
                    active ? "text-blue-400" : completed ? "text-emerald-500/70" : "text-zinc-600"
                )}>
                    {completed ? "Ukończono" : active ? "W trakcie" : "Kolejny"}
                </span>
                <span className={cn(
                    "text-xs font-semibold mt-0.5 transition-colors",
                    active ? "text-white" : "text-zinc-500"
                )}>
                    {label}
                </span>
            </div>
            {active && (
                <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-4 h-1 w-1 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"
                />
            )}
        </button>
    );
}
