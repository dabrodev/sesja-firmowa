"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { User, Building2, Sparkles, ChevronRight, ChevronLeft, CheckCircle2, Coins } from "lucide-react";
import Link from "next/link";
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
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession } from "@/lib/sessions";
import { assetService } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { CopyPlus } from "lucide-react";
import { extractR2KeyFromReference, referenceUrlToPhotoAsset } from "@/lib/reference-assets";
import { isPresetReference } from "@/lib/preset-assets";
import {
    DEFAULT_REQUESTED_COUNT,
    formatPhotoCountLabel,
    getRequestedCountOptions,
} from "@/lib/requested-count";
import {
    SESSION_GENERATION_COST_PER_PHOTO,
    startSessionGeneration,
} from "@/lib/session-generation";
import { PresetSelector, PRESET_OUTFITS } from "@/components/preset-selector";

type WizardStepId = "face" | "office" | "generate";

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
            return trimmed;
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

export function SessionWizard({
    sessionId: initialSessionId,
    onNewSessionRequested,
}: {
    sessionId?: string;
    onNewSessionRequested?: () => void;
}) {
    const router = useRouter();
    const [step, setStep] = useState<WizardStepId>("face");
    const [isGenerating, setIsGenerating] = useState(false);
    const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<Photosession | null>(null);
    const [customPrompt, setCustomPrompt] = useState("");
    const [requestedCount, setRequestedCount] = useState(DEFAULT_REQUESTED_COUNT);
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
        setOutfit,
    } = useAppStore();
    const activeSessionId = initialSessionId ?? createdSessionId;

    useEffect(() => {
        if (initialSessionId && user) {
            void sessionService.getSessionById(initialSessionId).then(async (data) => {
                if (!data || data.userId !== user.uid) return;

                const userAssets = await assetService.getAllUserAssets(user.uid);
                const validReferenceUrls = new Set(userAssets.map((asset) => asset.url));
                const validReferenceKeys = new Set(userAssets.map((asset) => asset.id));
                const isKnownReference = (reference: string) => {
                    if (isPresetReference(reference)) return true;
                    if (validReferenceUrls.has(reference)) return true;
                    const key = extractR2KeyFromReference(reference);
                    return Boolean(key && validReferenceKeys.has(key));
                };

                const sanitizedFaceReferences = data.faceReferences.filter((reference) => isKnownReference(reference));
                const sanitizedOfficeReferences = data.officeReferences.filter((reference) => isKnownReference(reference));
                const sanitizedOutfitReferences = data.outfitReferences.filter((reference) => isKnownReference(reference));
                const hasReferenceMismatch =
                    sanitizedFaceReferences.length !== data.faceReferences.length ||
                    sanitizedOfficeReferences.length !== data.officeReferences.length ||
                    sanitizedOutfitReferences.length !== data.outfitReferences.length;

                const sanitizedData: Photosession = hasReferenceMismatch
                    ? {
                        ...data,
                        faceReferences: sanitizedFaceReferences,
                        officeReferences: sanitizedOfficeReferences,
                        outfitReferences: sanitizedOutfitReferences,
                    }
                    : data;

                if (hasReferenceMismatch && sanitizedData.id) {
                    await sessionService.updateSession(sanitizedData.id, {
                        faceReferences: sanitizedFaceReferences,
                        officeReferences: sanitizedOfficeReferences,
                        outfitReferences: sanitizedOutfitReferences,
                    });
                }

                setSessionData(sanitizedData);

                setPersona({
                    id: "default-persona",
                    name: "My Profile",
                    faceReferences: sanitizedData.faceReferences.map((reference, index) =>
                        referenceUrlToPhotoAsset(reference, index, "face")
                    ),
                });
                setOffice({
                    id: "default-office",
                    name: "Main Office",
                    officeReferences: sanitizedData.officeReferences.slice(0, 1).map((reference, index) =>
                        referenceUrlToPhotoAsset(reference, index, "office")
                    ),
                });
                setOutfit({
                    id: "default-outfit",
                    name: "Outfit References",
                    outfitReferences: sanitizedData.outfitReferences.map((reference, index) =>
                        referenceUrlToPhotoAsset(reference, index, "outfit")
                    ),
                });
                setCustomPrompt(sanitizedData.customPrompt);
                setRequestedCount(sanitizedData.requestedCount);
            });
        }
    }, [initialSessionId, user, setOffice, setOutfit, setPersona]);

    const faceAssets = currentPersona?.faceReferences || [];
    const officeAssets = currentOffice?.officeReferences || [];
    const outfitAssets = currentOutfit?.outfitReferences || [];

    const steps: { id: WizardStepId; label: string; icon: React.ReactNode; completed: boolean }[] = [
        { id: "face", label: "Wizerunek", icon: <User className="h-4 w-4" />, completed: faceAssets.length >= 1 },
        { id: "office", label: "Biuro i styl", icon: <Building2 className="h-4 w-4" />, completed: faceAssets.length >= 1 },
        { id: "generate", label: "Generuj", icon: <Sparkles className="h-4 w-4" />, completed: false },
    ];
    const totalCost = requestedCount * SESSION_GENERATION_COST_PER_PHOTO;
    const availableCredits = userProfile?.credits ?? 0;
    const missingCredits = Math.max(0, totalCost - availableCredits);
    const hasKnownCredits = typeof userProfile?.credits === "number";
    const hasEnoughCredits = hasKnownCredits && availableCredits >= totalCost;
    const requestedCountOptions = getRequestedCountOptions(requestedCount);

    if (!user) {
        return null;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-8 px-4 py-12">
            <div className="mb-12 flex items-center justify-center gap-4">
                {steps.map((currentStep, index) => (
                    <React.Fragment key={currentStep.id}>
                        <WizardStep
                            active={step === currentStep.id}
                            completed={currentStep.completed}
                            icon={currentStep.icon}
                            label={currentStep.label}
                            onClick={() => {
                                const prevCompleted = index === 0 || steps[index - 1].completed;
                                if (prevCompleted || step === currentStep.id) {
                                    setStep(currentStep.id);
                                }
                            }}
                        />
                        {index < steps.length - 1 ? (
                            <div
                                className={cn(
                                    "h-px w-12 transition-all duration-700",
                                    currentStep.completed
                                        ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                        : "bg-white/10"
                                )}
                            />
                        ) : null}
                    </React.Fragment>
                ))}
            </div>

            <Card className="relative overflow-hidden border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-30" />
                <CardContent className="p-8">
                    <AnimatePresence mode="wait">
                        {step === "face" ? (
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
                                        className="h-12 bg-blue-600 px-8 shadow-lg shadow-blue-500/20 hover:bg-blue-700"
                                    >
                                        dalej: biuro i ubiór <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ) : null}

                        {step === "office" ? (
                            <motion.div
                                key="office-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                                    Lokalizacja biurowa jest opcjonalna. Jeśli jej nie dodasz, opisz miejsce w kolejnym kroku w polu prompt.
                                </div>
                                <PhotoUploader
                                    title="Lokalizacja biurowa (opcjonalnie)"
                                    description="Wgraj własne, naturalne zdjęcie biura. Używamy jednej lokacji, aby uniknąć miksowania pomieszczeń i błędnych proporcji."
                                    assets={officeAssets}
                                    onUpload={(asset) => {
                                        officeAssets.forEach((currentAsset) => removeOfficeReference(currentAsset.id));
                                        addOfficeReference(asset);
                                    }}
                                    onRemove={removeOfficeReference}
                                    maxFiles={1}
                                    userId={user.uid}
                                    assetType="office"
                                />
                                <PresetSelector
                                    title="Przykładowe stylizacje (opcjonalnie)"
                                    description="Wybierz styl, który najbardziej pasuje do klimatu zdjęć."
                                    presets={PRESET_OUTFITS}
                                    selectedAssets={outfitAssets}
                                    onSelect={addOutfitReference}
                                    onDeselect={removeOutfitReference}
                                    multiple={true}
                                    showGenderFilter={true}
                                />
                                <PhotoUploader
                                    title="Własne referencje ubioru (opcjonalnie)"
                                    description="Dodaj własne zdjęcia ubrań lub stylizacji (np. koszula, spodnie, spódnica), aby AI docelowo wygenerowało taki strój."
                                    assets={outfitAssets}
                                    onUpload={addOutfitReference}
                                    onRemove={removeOutfitReference}
                                    maxFiles={6}
                                    userId={user.uid}
                                    assetType="outfit"
                                />
                                <div className="flex justify-between">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setStep("face")}
                                        className="text-zinc-400 hover:bg-white/5"
                                    >
                                        <ChevronLeft className="mr-2 h-4 w-4" /> Wróć do zdjęć twarzy
                                    </Button>
                                    <Button
                                        onClick={() => setStep("generate")}
                                        className="h-12 border border-white/10 bg-gradient-to-br from-blue-600 to-indigo-700 px-8 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-600"
                                    >
                                        dalej: prompt i start <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ) : null}

                        {step === "generate" ? (
                            <motion.div
                                key="generate-step"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                {!isGenerating ? (
                                    <div className="space-y-8 py-12 text-center">
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400"
                                        >
                                            <Sparkles className="h-10 w-10 animate-pulse" />
                                        </motion.div>
                                        <div>
                                            <h2 className="text-3xl font-bold tracking-tight text-white">
                                                {sessionData ? "Kontynuuj wskazaną sesję" : "Gotowy na nową sesję?"}
                                            </h2>
                                            <p className="mx-auto mt-4 max-w-md leading-relaxed text-zinc-400">
                                                {sessionData
                                                    ? `Kontynuujesz sesję "${sessionData.name}". Po starcie od razu przejdziesz do widoku sesji, gdzie będą pojawiać się kolejne zdjęcia.`
                                                    : "Wszystkie dane zostały przygotowane. Po starcie od razu przeniesiemy Cię do sesji, gdzie wyniki będą wpadały na żywo."}
                                            </p>
                                        </div>

                                        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-3">
                                            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all hover:border-blue-500/30">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-blue-400">
                                                    Postać
                                                </span>
                                                <div className="mt-1 text-lg font-medium text-white">{faceAssets.length} zdjęć referencyjnych</div>
                                            </div>
                                            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all hover:border-blue-500/30">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-blue-400">
                                                    Otoczenie
                                                </span>
                                                <div className="mt-1 text-lg font-medium text-white">{officeAssets.length} lokalizacji biurowej</div>
                                            </div>
                                            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-all hover:border-blue-500/30">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-blue-400">
                                                    Ubiór
                                                </span>
                                                <div className="mt-1 text-lg font-medium text-white">{outfitAssets.length} referencji stylu</div>
                                            </div>
                                        </div>

                                        <div className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-left">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                                            {requestedCountOptions.map((value) => (
                                                                <SelectItem key={value} value={String(value)}>
                                                                    {formatPhotoCountLabel(value)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm">
                                                    <div className="text-zinc-300">Koszt tej generacji</div>
                                                    <div className="mt-1 text-2xl font-semibold text-white">{totalCost} PKT</div>
                                                    <div className="text-xs text-zinc-400">
                                                        {SESSION_GENERATION_COST_PER_PHOTO} PKT za każde zdjęcie
                                                    </div>
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
                                                                <Button size="sm" className="bg-red-600 text-white hover:bg-red-500">
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
                                                <label
                                                    htmlFor="session-custom-prompt"
                                                    className="text-xs font-semibold uppercase tracking-wide text-zinc-400"
                                                >
                                                    Prompt tekstowy (opcjonalnie)
                                                </label>
                                                <Textarea
                                                    id="session-custom-prompt"
                                                    value={customPrompt}
                                                    onChange={(event) => setCustomPrompt(event.target.value)}
                                                    placeholder="Np. osoba pracująca przy biurku, spokojny wyraz twarzy, formalna koszula, styl editorial."
                                                    className="min-h-[110px] border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                                                />
                                                <p className="text-xs text-zinc-500">
                                                    Jeśli podasz prompt, ma najwyższy priorytet dla kadru/pozy/stylu. Jeśli nie dodasz zdjęcia biura, opisz tutaj miejsce. Gdy pole jest puste, użyjemy domyślnego stylu biznesowego.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-4 pt-4">
                                            <Button
                                                size="lg"
                                                disabled={isGenerating || !hasEnoughCredits}
                                                onClick={async () => {
                                                    if (!user || !hasEnoughCredits || isGenerating) return;

                                                    setIsGenerating(true);
                                                    setGenerationError(null);

                                                    try {
                                                        const startedRun = await startSessionGeneration({
                                                            userId: user.uid,
                                                            existingSessionId: activeSessionId,
                                                            existingResultsCount: sessionData?.results.length ?? 0,
                                                            faceReferences: {
                                                                urls: faceAssets.map((asset) => asset.url),
                                                                keys: faceAssets.map((asset) => asset.id),
                                                            },
                                                            officeReferences: {
                                                                urls: officeAssets.slice(0, 1).map((asset) => asset.url),
                                                                keys: officeAssets.slice(0, 1).map((asset) => asset.id),
                                                            },
                                                            outfitReferences: {
                                                                urls: outfitAssets.map((asset) => asset.url),
                                                                keys: outfitAssets.map((asset) => asset.id),
                                                            },
                                                            customPrompt,
                                                            requestedCount,
                                                        });

                                                        setCreatedSessionId(startedRun.sessionId);
                                                        router.push(`/sesje/${startedRun.sessionId}#results`);
                                                    } catch (error: unknown) {
                                                        setGenerationError(
                                                            `Błąd generowania: ${getReadableError(error, "Nie udało się uruchomić sesji.")}`
                                                        );
                                                        setIsGenerating(false);
                                                    }
                                                }}
                                                className="min-h-16 h-auto w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-4 text-center text-base font-bold leading-tight text-white shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 hover:from-blue-500 hover:to-indigo-600 active:scale-95 sm:text-lg"
                                            >
                                                {isGenerating ? (
                                                    <div className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white align-middle" />
                                                ) : null}
                                                {sessionData ? `Kontynuuj sesję (+${requestedCount} zdjęć)` : `Utwórz nową sesję (+${requestedCount} zdjęć)`}
                                            </Button>

                                            {generationError ? (
                                                <div className="mt-4 w-full max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-200">
                                                    {generationError}
                                                </div>
                                            ) : null}

                                            {sessionData && onNewSessionRequested ? (
                                                <Button
                                                    variant="ghost"
                                                    className="text-zinc-400 hover:text-white"
                                                    onClick={onNewSessionRequested}
                                                >
                                                    <CopyPlus className="mr-2 h-4 w-4" />
                                                    Chcę utworzyć całkowicie nową sesję
                                                </Button>
                                            ) : null}

                                            <p className="text-xs text-zinc-500">koszt: {totalCost} PKT ({formatPhotoCountLabel(requestedCount)} AI)</p>
                                            <Button
                                                variant="ghost"
                                                onClick={() => setStep("office")}
                                                className="text-zinc-500 transition-colors hover:text-white"
                                            >
                                                <ChevronLeft className="mr-2 h-4 w-4" /> Wróć do edycji parametrów
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 py-24 text-center">
                                        <div className="relative mx-auto h-32 w-32">
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl"
                                            />
                                            <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl shadow-blue-500/50">
                                                <Sparkles className="h-14 w-14 animate-pulse text-white" />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h2 className="text-3xl font-bold tracking-tight text-white">Uruchamiamy twoją sesję...</h2>
                                            <p className="mx-auto max-w-lg text-sm text-zinc-400">
                                                Za chwilę przejdziesz do widoku sesji. Tam będą pojawiać się kolejne zdjęcia i stamtąd dodasz następne ujęcia.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : null}
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
    onClick,
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
                active ? "scale-105 opacity-100" : completed ? "opacity-80" : "opacity-40 hover:opacity-100"
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
                <span
                    className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
                        active ? "text-blue-400" : completed ? "text-emerald-500/70" : "text-zinc-600"
                    )}
                >
                    {completed ? "Ukończono" : active ? "W trakcie" : "Kolejny"}
                </span>
                <span
                    className={cn(
                        "mt-0.5 text-xs font-semibold transition-colors",
                        active ? "text-white" : "text-zinc-500"
                    )}
                >
                    {label}
                </span>
            </div>
            {active ? (
                <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-4 h-1 w-1 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"
                />
            ) : null}
        </button>
    );
}
