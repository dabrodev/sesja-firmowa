"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploader } from "@/components/photo-uploader";
import { useAuth } from "@/components/auth-provider";
import { PhotoAsset } from "@/lib/store";

export default function CustomGeneratorPage() {
    const { user } = useAuth();
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [assets, setAssets] = useState<PhotoAsset[]>([]);

    const addAsset = (asset: PhotoAsset) => setAssets(prev => [...prev, asset]);
    const removeAsset = (id: string) => setAssets(prev => prev.filter(a => a.id !== id));

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setError(null);
        setResultUrl(null);

        try {
            const res = await fetch("/api/generate-custom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    referenceKeys: assets.map(a => a.id)
                }),
            });

            if (!res.ok) {
                const data = await res.json() as { error?: string };
                throw new Error(data.error || "Wystąpił błąd podczas generowania");
            }

            const data = await res.json() as { url: string };
            setResultUrl(data.url);
        } catch (err: any) {
            console.error("Failed to generate custom image:", err);
            setError(err.message || "Błąd generowania");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
            <div className="mx-auto max-w-4xl space-y-8 py-12 px-4">
                <div className="text-center space-y-4 mb-12">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                        <Sparkles className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-sm">
                        Wolny Generator
                    </h1>
                    <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
                        Opisz dowolną scenę i wygeneruj profesjonalne zdjęcie za pomocą modelu <span className="text-blue-400 font-medium">Gemini 3.1 Flash</span>. Zignoruj ograniczenia i stwórz co tylko chcesz.
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
                                userId={user?.uid!}
                                assetType="face"
                            />
                        </div>

                        <div className="space-y-3">
                            <label htmlFor="prompt" className="text-sm font-medium text-zinc-300 ml-1">
                                Twój Prompt
                            </label>
                            <Textarea
                                id="prompt"
                                placeholder="np. Portret w stylu cyberpunkowym, neony, nocne miasto w deszczu, 85mm f/1.4..."
                                className="min-h-[120px] bg-black/40 border-white/10 focus-visible:ring-blue-500/50 text-base text-white placeholder:text-zinc-500 resize-y"
                                value={prompt}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                disabled={isGenerating}
                            />
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <div className="text-xs text-zinc-500">
                                Koszt: <span className="text-zinc-300 font-medium">0 PKT</span> (Wersja Beta)
                            </div>
                            <Button
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-500 text-white min-w-[200px]"
                                disabled={!prompt.trim() || isGenerating}
                                onClick={handleGenerate}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Generowanie...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-5 w-5" />
                                        Generuj Zdjęcie
                                    </>
                                )}
                            </Button>
                        </div>

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
                                Wynik Generowania
                            </h3>
                            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/50 aspect-[3/2] relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={resultUrl}
                                    alt="Wygenerowane zdjęcie"
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
