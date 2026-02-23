"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import { PhotoUploader } from "@/components/photo-uploader";
import { GenerationResults } from "@/components/generation-results";

export function SessionWizard() {
    const [step, setStep] = useState<"face" | "office" | "generate">("face");
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    const { currentPersona, currentOffice, addFaceReference, removeFaceReference, addOfficeReference, removeOfficeReference } = useAppStore();

    const faceAssets = currentPersona?.faceReferences || [];
    const officeAssets = currentOffice?.officeReferences || [];

    return (
        <div className="mx-auto max-w-5xl space-y-8 py-12 px-4">
            {/* Wizard Progress */}
            <div className="flex items-center justify-center gap-4">
                <WizardStep
                    active={step === "face"}
                    completed={faceAssets.length >= 3}
                    icon={<User className="h-4 w-4" />}
                    label="Face References"
                />
                <div className="h-px w-12 bg-white/10" />
                <WizardStep
                    active={step === "office"}
                    completed={officeAssets.length >= 1}
                    icon={<Building2 className="h-4 w-4" />}
                    label="Office Identity"
                />
                <div className="h-px w-12 bg-white/10" />
                <WizardStep
                    active={step === "generate"}
                    completed={false}
                    icon={<Sparkles className="h-4 w-4" />}
                    label="AI Generation"
                />
            </div>

            <Card className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl">
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
                                    title="Your Face References"
                                    description="Upload at least 3 high-quality portraits from different angles. This helps the AI learn your features for the corporate shoot."
                                    assets={faceAssets}
                                    onUpload={addFaceReference}
                                    onRemove={removeFaceReference}
                                    maxFiles={10}
                                />
                                <div className="flex justify-end">
                                    <Button
                                        disabled={faceAssets.length < 3}
                                        onClick={() => setStep("office")}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        Next Step: Office Context <ChevronRight className="ml-2 h-4 w-4" />
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
                                    title="Office Environments"
                                    description="Upload photos of your workspace, reception, or meeting rooms. The AI will place you in these exact environments."
                                    assets={officeAssets}
                                    onUpload={addOfficeReference}
                                    onRemove={removeOfficeReference}
                                    maxFiles={5}
                                />
                                <div className="flex justify-between">
                                    <Button variant="ghost" onClick={() => setStep("face")} className="text-zinc-400">
                                        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Face
                                    </Button>
                                    <Button
                                        disabled={officeAssets.length < 1}
                                        onClick={() => setStep("generate")}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        Next Step: Review & Generate <ChevronRight className="ml-2 h-4 w-4" />
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
                                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                                            <Sparkles className="h-10 w-10" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">Wszystko gotowe</h2>
                                            <p className="mx-auto mt-2 max-w-md text-zinc-400">
                                                Dopasowaliśmy Twoje zdjęcia do wybranych wnętrz biurowych.
                                                Twoja spersonalizowana sesja jest gotowa do wygenerowania.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                                            <div className="rounded-lg bg-white/5 p-4 border border-white/10 text-left">
                                                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Postać</span>
                                                <div className="mt-1 font-medium">{faceAssets.length} zdjęć referencyjnych</div>
                                            </div>
                                            <div className="rounded-lg bg-white/5 p-4 border border-white/10 text-left">
                                                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Otoczenie</span>
                                                <div className="mt-1 font-medium">{officeAssets.length} lokalizacji</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center gap-4 pt-10">
                                            <Button
                                                size="lg"
                                                onClick={() => {
                                                    setIsGenerating(true);
                                                    setTimeout(() => {
                                                        setHasCompleted(true);
                                                        setIsGenerating(false);
                                                    }, 3000);
                                                }}
                                                className="h-14 w-64 bg-blue-600 text-lg font-bold hover:bg-blue-700"
                                            >
                                                Generuj sesję
                                            </Button>
                                            <Button variant="ghost" onClick={() => setStep("office")} className="text-zinc-400">
                                                <ChevronLeft className="mr-2 h-4 w-4" /> Powrót
                                            </Button>
                                        </div>
                                    </div>
                                ) : isGenerating ? (
                                    <div className="text-center space-y-8 py-24">
                                        <div className="relative mx-auto h-24 w-24">
                                            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
                                            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-blue-600">
                                                <Sparkles className="h-10 w-10 text-white animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h2 className="text-2xl font-bold text-white">Tworzymy magię...</h2>
                                            <p className="text-zinc-400 italic">Dopasowujemy światło, tekstury i głębię Twojego biura.</p>
                                        </div>
                                    </div>
                                ) : null}

                                {hasCompleted && <GenerationResults />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </div>
    );
}

function WizardStep({ active, completed, icon, label }: { active: boolean, completed: boolean, icon: React.ReactNode, label: string }) {
    return (
        <div className={cn(
            "flex flex-col items-center gap-2",
            active ? "text-blue-400" : completed ? "text-emerald-400" : "text-zinc-500"
        )}>
            <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                active ? "border-blue-400 bg-blue-400/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]" :
                    completed ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5"
            )}>
                {completed ? <CheckCircle2 className="h-5 w-5" /> : icon}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
    );
}

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
