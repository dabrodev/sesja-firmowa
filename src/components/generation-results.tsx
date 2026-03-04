"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { downloadFile } from "@/lib/download";

interface GenerationResultsProps {
    sessionId?: string | null;
    resultUrls?: string[];
    expectedCount?: number;
}

export function GenerationResults({ sessionId, resultUrls = [], expectedCount = 4 }: GenerationResultsProps) {
    const { resetSession } = useAppStore();
    const router = useRouter();
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const availableIndices = useMemo(
        () =>
            resultUrls.reduce<number[]>((acc, url, index) => {
                if (url) acc.push(index);
                return acc;
            }, []),
        [resultUrls]
    );
    const currentPosition = selectedIndex !== null ? availableIndices.indexOf(selectedIndex) : -1;
    const currentImage = selectedIndex !== null ? resultUrls[selectedIndex] ?? null : null;
    const hasPrev = currentPosition > 0;
    const hasNext = currentPosition >= 0 && currentPosition < availableIndices.length - 1;

    const closeLightbox = useCallback(() => {
        setSelectedIndex(null);
    }, []);

    const goPrev = useCallback(() => {
        if (!hasPrev) return;
        setSelectedIndex(availableIndices[currentPosition - 1]);
    }, [availableIndices, currentPosition, hasPrev]);

    const goNext = useCallback(() => {
        if (!hasNext) return;
        setSelectedIndex(availableIndices[currentPosition + 1]);
    }, [availableIndices, currentPosition, hasNext]);

    useEffect(() => {
        if (selectedIndex === null) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeLightbox();
                return;
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                goPrev();
                return;
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                goNext();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [closeLightbox, goNext, goPrev, selectedIndex]);

    const handleDownload = async (url: string, index: number) => {
        try {
            const baseName = sessionId ? `sesja-${sessionId}` : "sesja";
            await downloadFile(url, `${baseName}-photo-${index + 1}.jpg`);
        } catch (error) {
            console.error("Error downloading image:", error);
            alert("Nie udało się pobrać zdjęcia. Spróbuj ponownie za chwilę.");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-bold text-white">Sesja gotowa</h2>
                <div className="flex flex-col items-center gap-2 mt-2">
                    <p className="text-zinc-400">Oto twoje profesjonalne zdjęcia biznesowe.</p>
                    {sessionId && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                            zapisano w twoich sesjach
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: expectedCount }).map((_, i) => {
                    const url = resultUrls[i];

                    if (!url) {
                        return (
                            <div key={`skeleton-${i}`} className="aspect-[3/4] rounded-2xl border border-white/5 bg-white/5 animate-pulse flex flex-col items-center justify-center">
                                <span className="text-white/30 text-sm mb-2">Generowanie ({i + 1}/{expectedCount})...</span>
                                <div className="h-6 w-6 border-2 border-blue-500/50 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        );
                    }

                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl cursor-pointer"
                            onClick={() => setSelectedIndex(i)}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={`Wynik ${i + 1}`}
                                className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
                                onError={(e) => {
                                    setTimeout(() => { (e.target as HTMLImageElement).src = url + "&retry=" + Date.now(); }, 2000);
                                }}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-4">
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleDownload(url, i);
                                    }}
                                >
                                    <Download className="h-5 w-5" />
                                </Button>
                                <Button size="icon" variant="secondary" className="rounded-full" onClick={(e) => e.stopPropagation()}>
                                    <Share2 className="h-5 w-5" />
                                </Button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="flex justify-center pt-8">
                <Button
                    size="lg"
                    className="bg-white text-black hover:bg-zinc-200"
                    onClick={() => {
                        resetSession();
                        if (sessionId) {
                            router.push(`/sesje/${sessionId}`);
                            return;
                        }
                        window.location.reload();
                    }}
                >
                    {sessionId ? "przejdź do sesji" : "rozpocznij nową sesję"}
                </Button>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {currentImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeLightbox}
                        className="fixed inset-0 z-[100] bg-black/70 p-4 backdrop-blur-sm md:p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Podgląd zdjęcia ${Math.max(1, currentPosition + 1)} z ${Math.max(1, availableIndices.length)}`}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative mx-auto flex max-h-[92vh] w-auto max-w-[95vw] items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/90 p-2 shadow-2xl md:p-3"
                        >
                            <Button
                                size="icon"
                                variant="secondary"
                                onClick={closeLightbox}
                                className="absolute right-3 top-3 z-20 rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
                                aria-label="Zamknij podgląd"
                            >
                                <X className="h-4 w-4" />
                            </Button>

                            {availableIndices.length > 1 && (
                                <>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        onClick={goPrev}
                                        disabled={!hasPrev}
                                        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                                        aria-label="Poprzednie zdjęcie"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        onClick={goNext}
                                        disabled={!hasNext}
                                        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                                        aria-label="Następne zdjęcie"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                    <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white">
                                        {currentPosition + 1} / {availableIndices.length}
                                    </div>
                                </>
                            )}

                            <motion.img
                                src={currentImage}
                                alt="Powiększone zdjęcie"
                                className="max-h-[86vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
