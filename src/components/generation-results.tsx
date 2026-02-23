"use client";

import { motion } from "framer-motion";
import { Download, Share2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MOCK_RESULTS = [
    "/photoshoot-team.png",
    "/photoshoot-architekt-v2.png",
    "/photoshoot-lekarz.png",
    "/photoshoot-nieruchomosci.png",
    "/photoshoot-rzemieslnik.png",
    "/photoshoot-1.png",
    "/photoshoot-2.png",
    "/photoshoot-3.png",
    "/corporate-portrait.png",
];

export function GenerationResults() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-bold text-white">Sesja gotowa</h2>
                <p className="text-zinc-400 mt-2">Oto Twoje profesjonalne zdjęcia biznesowe.</p>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                {MOCK_RESULTS.map((url, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
                    >
                        <img src={url} alt={`Wynik ${i}`} className="h-full w-full object-cover grayscale-[0.2] transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-4">
                            <Button size="icon" variant="secondary" className="rounded-full">
                                <Download className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="secondary" className="rounded-full">
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="flex justify-center pt-8">
                <Button size="lg" className="bg-white text-black hover:bg-zinc-200" onClick={() => window.location.reload()}>
                    Rozpocznij nową sesję
                </Button>
            </div>
        </div>
    );
}
