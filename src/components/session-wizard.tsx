"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, Sparkles, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { PhotoUploader } from "@/components/photo-uploader";
import { GenerationResults } from "@/components/generation-results";
import { useAuth } from "@/components/auth-provider";
import { sessionService } from "@/lib/sessions";
import { userService } from "@/lib/users";
import { projectService } from "@/lib/projects";
import { cn } from "@/lib/utils";

export function SessionWizard({ projectId }: { projectId?: string }) {
    const [step, setStep] = useState<"face" | "office" | "generate">("face");
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [resultUrls, setResultUrls] = useState<string[]>([]);
    const [generationStatus, setGenerationStatus] = useState<string>("Inicjalizuję...");
    const { user, userProfile } = useAuth();
    const { currentPersona, currentOffice, addFaceReference, removeFaceReference, addOfficeReference, removeOfficeReference } = useAppStore();

    const faceAssets = currentPersona?.faceReferences || [];
    const officeAssets = currentOffice?.officeReferences || [];

    const steps = [
        { id: "face", label: "Wizerunek", icon: <User className="h-4 w-4" />, completed: faceAssets.length >= 1 },
        { id: "office", label: "Biuro", icon: <Building2 className="h-4 w-4" />, completed: officeAssets.length >= 1 },
        { id: "generate", label: "Generuj", icon: <Sparkles className="h-4 w-4" />, completed: hasCompleted }
    ];

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
                                if (prevCompleted || step === s.id) setStep(s.id as any);
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
                                    description="Wgraj 1 wyraźne zdjęcie swojej twarzy. Dzięki temu AI nauczy się Twoich rysów i idealnie dopasuje je do sesji."
                                    assets={faceAssets}
                                    onUpload={addFaceReference}
                                    onRemove={removeFaceReference}
                                    maxFiles={1}
                                    userId={user?.uid!}
                                    assetType="face"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        disabled={faceAssets.length < 1}
                                        onClick={() => setStep("office")}
                                        className="bg-blue-600 hover:bg-blue-700 h-12 px-8 shadow-lg shadow-blue-500/20"
                                    >
                                        dalej: biuro i lokalizacja <ChevronRight className="ml-2 h-4 w-4" />
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
                                    description="Wgraj zdjęcia swojego biura lub wybierz jedno z naszych wnętrz. AI umieści Cię w profesjonalnym otoczeniu biznesowym."
                                    assets={officeAssets}
                                    onUpload={addOfficeReference}
                                    onRemove={removeOfficeReference}
                                    maxFiles={5}
                                    userId={user?.uid!}
                                    assetType="office"
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
                                        dalej: podsumowanie <ChevronRight className="ml-2 h-4 w-4" />
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
                                            <h2 className="text-3xl font-bold text-white tracking-tight">Gotowy na sesję AI?</h2>
                                            <p className="mx-auto mt-4 max-w-md text-zinc-400 leading-relaxed">
                                                Wszystkie dane zostały przygotowane. System AI przeanalizuje twoje rysy i stworzy fotorealistyczną sesję w wybranych wnętrzach.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                                            <div className="rounded-2xl bg-white/5 p-5 border border-white/10 text-left hover:border-blue-500/30 transition-all group">
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 group-hover:text-blue-400 transition-colors">Postać</span>
                                                <div className="mt-1 text-lg font-medium text-white">{faceAssets.length} zdjęć referencyjnych</div>
                                            </div>
                                            <div className="rounded-2xl bg-white/5 p-5 border border-white/10 text-left hover:border-blue-500/30 transition-all group">
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 group-hover:text-blue-400 transition-colors">Otoczenie</span>
                                                <div className="mt-1 text-lg font-medium text-white">{officeAssets.length} lokalizacji biurowej</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-4 pt-10">
                                            <Button
                                                size="lg"
                                                disabled={isGenerating || (userProfile ? userProfile.credits < 120 : true)}
                                                onClick={async () => {
                                                    if (!user) return;
                                                    const cost = 120; // 4 photos × 30 pts

                                                    if (userProfile && userProfile.credits < cost) {
                                                        alert("Brak punktów. Potrzebujesz " + cost + " pkt.");
                                                        return;
                                                    }

                                                    setIsGenerating(true);
                                                    setGenerationStatus("Inicjalizuję sesję...");

                                                    try {
                                                        // Ensure we have a project ID to attach this session to
                                                        let actualProjectId = projectId;
                                                        if (!actualProjectId) {
                                                            actualProjectId = await projectService.createProject(user.uid, "Mój pierwszy projekt");
                                                        }

                                                        const id = await sessionService.saveSession(user.uid, {
                                                            faceReferences: faceAssets.map(a => a.url),
                                                            officeReferences: officeAssets.map(a => a.url),
                                                            results: [],
                                                            status: "processing"
                                                        }, actualProjectId);
                                                        setSessionId(id);
                                                        await userService.deductCredits(user.uid, cost);

                                                        setGenerationStatus("Uruchamiam workflow...");
                                                        const resp = await fetch("/api/generate", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                sessionId: id,
                                                                uid: user.uid,
                                                                faceKeys: faceAssets.map(a => a.id),
                                                                officeKeys: officeAssets.map(a => a.id),
                                                            })
                                                        });

                                                        if (!resp.ok) {
                                                            const err = await resp.json() as { error?: string };
                                                            throw new Error(err.error || "Nie udało się uruchomić generowania");
                                                        }

                                                        const { instanceId } = await resp.json() as { instanceId: string };
                                                        setGenerationStatus("Analizuję zdjęcia referencyjne...");
                                                        let attempts = 0;
                                                        const maxAttempts = 120;

                                                        await new Promise<void>((resolve, reject) => {
                                                            const poll = setInterval(async () => {
                                                                attempts++;
                                                                try {
                                                                    const sr = await fetch(`/api/status?instanceId=${encodeURIComponent(instanceId)}`);
                                                                    const data = await sr.json() as { status: string; output?: { resultUrls: string[] }; error?: string };

                                                                    if (attempts < 5) setGenerationStatus("Generuję opis fotograficzny...");
                                                                    else if (attempts < 15) setGenerationStatus("Generuję fotografię 1/4...");
                                                                    else if (attempts < 25) setGenerationStatus("Generuję fotografię 2/4...");
                                                                    else if (attempts < 35) setGenerationStatus("Generuję fotografię 3/4...");
                                                                    else setGenerationStatus("Generuję fotografię 4/4...");

                                                                    if (data.status === "complete") {
                                                                        clearInterval(poll);
                                                                        const urls = data.output?.resultUrls ?? [];
                                                                        setResultUrls(urls);
                                                                        await sessionService.updateSession(id, { results: urls, status: "completed" });
                                                                        resolve();
                                                                    } else if (data.status === "errored" || data.status === "terminated") {
                                                                        clearInterval(poll);
                                                                        reject(new Error(data.error || "Workflow zakończony błędem"));
                                                                    } else if (attempts >= maxAttempts) {
                                                                        clearInterval(poll);
                                                                        reject(new Error("Przekroczono czas oczekiwania"));
                                                                    }
                                                                } catch (e) { console.warn("Poll error:", e); }
                                                            }, 3000);
                                                        });

                                                        setHasCompleted(true);
                                                        setIsGenerating(false);

                                                    } catch (error: any) {
                                                        console.error("Failed to generate:", error);
                                                        alert("Błąd generowania: " + error.message);
                                                        setIsGenerating(false);
                                                    }
                                                }}
                                                className="h-16 w-64 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-xl font-bold shadow-2xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 rounded-2xl text-white border border-white/10"
                                            >
                                                rozpocznij generowanie
                                            </Button>
                                            <p className="text-xs text-zinc-500">koszt: 120 PKT za 4 fotografie AI</p>
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

                                {hasCompleted && <GenerationResults sessionId={sessionId} resultUrls={resultUrls} />}
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
