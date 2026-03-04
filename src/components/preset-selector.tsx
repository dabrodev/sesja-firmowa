"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PhotoAsset } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
    PRESET_OFFICES as PRESET_OFFICES_FROM_LIB,
    PRESET_OUTFITS as PRESET_OUTFITS_FROM_LIB,
    type PresetAsset as PresetAssetFromLib,
} from "@/lib/preset-assets";

export type PresetItem = PresetAssetFromLib;

interface PresetSelectorProps {
    title: string;
    description: string;
    presets: PresetItem[];
    selectedAssets: PhotoAsset[];
    onSelect: (asset: PhotoAsset) => void;
    onDeselect: (id: string) => void;
    multiple?: boolean;
    showGenderFilter?: boolean;
}

export function PresetSelector({
    title,
    description,
    presets,
    selectedAssets,
    onSelect,
    onDeselect,
    multiple = false,
    showGenderFilter = false,
}: PresetSelectorProps) {
    const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female'>('female');

    const filteredPresets = presets.filter((p) => {
        if (!showGenderFilter || selectedGender === 'all') return true;
        return p.gender === selectedGender || p.gender === 'unisex';
    });

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="text-sm text-zinc-400">{description}</p>
            </div>
            {showGenderFilter && (
                <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/10 w-fit">
                    <button
                        onClick={() => setSelectedGender('all')}
                        className={cn(
                            "px-3 py-1 text-sm rounded-md transition-colors",
                            selectedGender === 'all' ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:text-white"
                        )}
                    >
                        Wszystkie
                    </button>
                    <button
                        onClick={() => setSelectedGender('female')}
                        className={cn(
                            "px-3 py-1 text-sm rounded-md transition-colors",
                            selectedGender === 'female' ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:text-white"
                        )}
                    >
                        Damskie
                    </button>
                    <button
                        onClick={() => setSelectedGender('male')}
                        className={cn(
                            "px-3 py-1 text-sm rounded-md transition-colors",
                            selectedGender === 'male' ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:text-white"
                        )}
                    >
                        Męskie
                    </button>
                </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {filteredPresets.map(preset => {
                    const isSelected = selectedAssets.some(a => a.id === preset.asset.id);
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                                if (isSelected) {
                                    onDeselect(preset.asset.id);
                                } else {
                                    if (!multiple) {
                                        // Odznaczamy wszystko z presetów, co było wybrane
                                        selectedAssets.forEach(a => {
                                            if (presets.some(p => p.asset.id === a.id)) {
                                                onDeselect(a.id);
                                            }
                                        });
                                    }
                                    onSelect(preset.asset);
                                }
                            }}
                            className={cn(
                                "group relative aspect-video overflow-hidden rounded-xl border-2 transition-all text-left bg-zinc-900 border-white/10 hover:border-blue-500/50",
                                isSelected && "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                            )}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={preset.asset.url}
                                alt={preset.label}
                                className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-110"
                            />
                            <div className="absolute inset-x-0 bottom-0 flex flex-col p-2 bg-gradient-to-t from-black/80 to-transparent">
                                <span className="text-xs font-medium text-white line-clamp-1">{preset.label}</span>
                            </div>
                            {isSelected && (
                                <div className="absolute top-2 right-2 rounded-full bg-blue-500 p-0.5 shadow-sm">
                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                </div>
                            )}
                        </button>
                    );
                })}
                {filteredPresets.length === 0 && (
                    <div className="col-span-2 text-center text-sm text-zinc-500 py-8">
                        Brak pasujących stylizacji.
                    </div>
                )}
            </div>
        </div>
    );
}

export const PRESET_OFFICES: PresetItem[] = PRESET_OFFICES_FROM_LIB;
export const PRESET_OUTFITS: PresetItem[] = PRESET_OUTFITS_FROM_LIB;
