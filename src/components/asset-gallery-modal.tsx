"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, Search, Trash2, Shield, AlertTriangle } from "lucide-react";
import { assetService } from "@/lib/assets";
import { PhotoAsset } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AssetGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    type: "face" | "office";
    onSelect: (assets: PhotoAsset[]) => void;
    maxSelectable?: number;
    currentSelected?: PhotoAsset[];
}

export function AssetGalleryModal({
    isOpen,
    onClose,
    userId,
    type,
    onSelect,
    maxSelectable = 5,
    currentSelected = []
}: AssetGalleryModalProps) {
    const [assets, setAssets] = useState<(PhotoAsset & { docId: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(currentSelected.map(a => a.id))
    );

    useEffect(() => {
        if (isOpen && userId) {
            loadAssets();
            // Reset selection based on currently selected assets in parent component
            setSelectedIds(new Set(currentSelected.map(a => a.id)));
        }
    }, [isOpen, userId, type, currentSelected]);

    const loadAssets = async () => {
        setIsLoading(true);
        try {
            const data = await assetService.getUserAssets(userId, type);
            // Ensure data has docId typing according to our state declaration
            setAssets(data as unknown as (PhotoAsset & { docId: string })[]);
        } catch (error) {
            console.error("Failed to load assets:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (assetId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(assetId)) {
            newSelected.delete(assetId);
        } else {
            if (newSelected.size >= maxSelectable) return;
            newSelected.add(assetId);
        }
        setSelectedIds(newSelected);
    };

    const handleConfirm = () => {
        const selectedAssets = assets.filter(a => selectedIds.has(a.id));
        onSelect(selectedAssets);
        onClose();
    };

    const handleDelete = async (docId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Czy na pewno chcesz usunąć to zdjęcie ze swojej galerii?")) return;

        try {
            await assetService.deleteAsset(docId);
            setAssets(assets.filter(a => a.docId !== docId));

            // Also remove from selection if it was selected
            const deletedAsset = assets.find(a => a.docId === docId);
            if (deletedAsset && selectedIds.has(deletedAsset.id)) {
                const newSelected = new Set(selectedIds);
                newSelected.delete(deletedAsset.id);
                setSelectedIds(newSelected);
            }
        } catch (error) {
            console.error("Failed to delete asset:", error);
            alert("Nie udało się usunąć zdjęcia.");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
                <div className="p-6 border-b border-white/10 bg-black/20">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
                            <Search className="h-5 w-5 text-blue-400" />
                            Wybierz z Galerii
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-base">
                            Wybierz wcześniej wgrane zdjęcia {type === "face" ? "twarzy" : "biura"},
                            aby użyć ich w nowej sesji. Możesz zaznaczyć do {maxSelectable} plików.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/40">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-400">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p>Wczytywanie Twojej galerii...</p>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-md mx-auto">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                <Search className="h-10 w-10 text-zinc-500" />
                            </div>
                            <h3 className="text-xl font-medium text-white">Galeria jest pusta</h3>
                            <p className="text-zinc-400">
                                Nie masz jeszcze zapisanych zdjęć {type === "face" ? "twarzy" : "biura"} w swojej chmurze. Zostaną one tu automatycznie dodane, gdy wgrasz je z komputera w generatorze.
                            </p>
                            <Button variant="outline" onClick={onClose} className="mt-4 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                Wróć do wgrywania
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-zinc-400">
                                    Wybrano {selectedIds.size} z {maxSelectable}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                                    <Shield className="h-3.5 w-3.5" />
                                    <span>Zabezpieczone w Twojej prywatnej chmurze</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                <AnimatePresence>
                                    {assets.map((asset) => {
                                        const isSelected = selectedIds.has(asset.id);
                                        const disabled = !isSelected && selectedIds.size >= maxSelectable;

                                        return (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key={asset.id}
                                                onClick={() => !disabled && toggleSelection(asset.id)}
                                                className={cn(
                                                    "group relative aspect-square overflow-hidden rounded-xl border bg-zinc-900 cursor-pointer transition-all duration-300",
                                                    isSelected
                                                        ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f172a]"
                                                        : "border-white/10 hover:border-white/30",
                                                    disabled && "opacity-40 cursor-not-allowed grayscale-[50%]"
                                                )}
                                            >
                                                <img
                                                    src={asset.url}
                                                    alt={asset.name}
                                                    className={cn(
                                                        "h-full w-full object-cover transition-transform duration-500",
                                                        isSelected ? "scale-105" : "group-hover:scale-110"
                                                    )}
                                                />
                                                <div className={cn(
                                                    "absolute inset-0 transition-opacity duration-300",
                                                    isSelected ? "bg-blue-500/20" : "bg-black/40 opacity-0 group-hover:opacity-100"
                                                )} />

                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e) => handleDelete(asset.docId, e)}
                                                    className={cn(
                                                        "absolute top-2 right-2 rounded-full bg-red-500/80 p-2 text-white transition-opacity hover:bg-red-500 shadow-lg backdrop-blur-md",
                                                        isSelected ? "opacity-0" : "opacity-0 group-hover:opacity-100" // Hide when selected
                                                    )}
                                                    title="Usuń zdjęcie z galerii"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>

                                                {/* Selection Indicator */}
                                                <div className={cn(
                                                    "absolute bottom-2 right-2 flex items-center justify-center rounded-full transition-all duration-300",
                                                    isSelected
                                                        ? "h-8 w-8 bg-blue-500 text-white shadow-lg scale-100"
                                                        : "h-6 w-6 bg-black/50 border border-white/50 text-transparent scale-0 group-hover:scale-100"
                                                )}>
                                                    <CheckCircle2 className={cn("h-5 w-5", isSelected ? "block" : "hidden")} />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center backdrop-blur-md">
                    <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white hover:bg-white/5">
                        Anuluj
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="bg-blue-600 hover:bg-blue-700 h-11 px-8 shadow-lg shadow-blue-500/20 text-white font-medium"
                    >
                        Zatwierdź Wybór ({selectedIds.size})
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
