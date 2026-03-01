"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

interface GenerationResultsProps {
    sessionId?: string | null;
    resultUrls?: string[];
}

export function GenerationResults({ sessionId, resultUrls = [] }: GenerationResultsProps) {
    const { resetSession } = useAppStore();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
                            zapisano w twoich projektach
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => {
                    const url = resultUrls[i];

                    if (!url) {
                        return (
                            <div key={`skeleton-${i}`} className="aspect-[3/4] rounded-2xl border border-white/5 bg-white/5 animate-pulse flex flex-col items-center justify-center">
                                <span className="text-white/30 text-sm mb-2">Generowanie ({i + 1}/4)...</span>
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
                            onClick={() => setSelectedImage(url)}
                        >
                            <img
                                src={url}
                                alt={`Wynik ${i + 1}`}
                                className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
                                onError={(e) => {
                                    setTimeout(() => { (e.target as HTMLImageElement).src = url + "&retry=" + Date.now(); }, 2000);
                                }}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-4">
                                <a href={url} download={`sesja-${i + 1}.jpg`} onClick={(e) => e.stopPropagation()}>
                                    <Button size="icon" variant="secondary" className="rounded-full">
                                        <Download className="h-5 w-5" />
                                    </Button>
                                </a>
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
                        window.location.reload();
                    }}
                >
                    rozpocznij nową sesję
                </Button>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImage(null)}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md cursor-zoom-out"
                    >
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={selectedImage}
                            alt="Powiększone zdjęcie"
                            className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
