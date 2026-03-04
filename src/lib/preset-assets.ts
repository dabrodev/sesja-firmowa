import type { PhotoAsset } from "./store";

export type PresetGender = "male" | "female" | "unisex";

export interface PresetAsset {
    id: string;
    label: string;
    asset: PhotoAsset;
    gender?: PresetGender;
}

export const PRESET_OFFICES: PresetAsset[] = [
    { id: "office_minimalist", label: "Jasne / Minimalistyczne biuro", asset: { id: "uploads/1772612811991-office_minimalist.png", url: "/samples/office_minimalist.png", name: "office_minimalist.png", size: 0 }, gender: "unisex" },
    { id: "office_corporate", label: "Ciemne / Sala Konferencyjna", asset: { id: "uploads/1772612811500-office_corporate.png", url: "/samples/office_corporate.png", name: "office_corporate.png", size: 0 }, gender: "unisex" },
    { id: "office_polish_modern", label: "Nowoczesne biuro (1-osobowe)", asset: { id: "uploads/1772618823226-office_polish_modern.png", url: "/samples/office_polish_modern.png", name: "office_polish_modern.png", size: 0 }, gender: "unisex" },
    { id: "office_lawyer", label: "Tradycyjne biuro (Kamienica)", asset: { id: "uploads/1772618823774-office_lawyer.png", url: "/samples/office_lawyer.png", name: "office_lawyer.png", size: 0 }, gender: "unisex" },
];

export const PRESET_OUTFITS: PresetAsset[] = [
    { id: "outfit_women_blazer", label: "Damska Elegancka Marynarka", asset: { id: "uploads/1772612813639-outfit_women_blazer.png", url: "/samples/outfit_women_blazer.png", name: "outfit_women_blazer.png", size: 0 }, gender: "female" },
    { id: "outfit_women_casual", label: "Damski Smart Casual", asset: { id: "uploads/1772612814137-outfit_women_casual.png", url: "/samples/outfit_women_casual.png", name: "outfit_women_casual.png", size: 0 }, gender: "female" },
    { id: "outfit_women_dress", label: "Damska Sukienka Biznesowa", asset: { id: "uploads/1772618824361-outfit_women_dress.png", url: "/samples/outfit_women_dress.png", name: "outfit_women_dress.png", size: 0 }, gender: "female" },
    { id: "outfit_women_turtleneck", label: "Damski Golf i Spodnie", asset: { id: "uploads/1772618824957-outfit_women_turtleneck.png", url: "/samples/outfit_women_turtleneck.png", name: "outfit_women_turtleneck.png", size: 0 }, gender: "female" },
    { id: "outfit_men_suit", label: "Męski Garnitur Biznesowy", asset: { id: "uploads/1772612813225-outfit_men_suit.png", url: "/samples/outfit_men_suit.png", name: "outfit_men_suit.png", size: 0 }, gender: "male" },
    { id: "outfit_men_casual", label: "Męski Smart Casual", asset: { id: "uploads/1772612812772-outfit_men_casual.png", url: "/samples/outfit_men_casual.png", name: "outfit_men_casual.png", size: 0 }, gender: "male" },
    { id: "outfit_men_turtleneck", label: "Męski Golf i Spodnie", asset: { id: "uploads/1772618825497-outfit_men_turtleneck.png", url: "/samples/outfit_men_turtleneck.png", name: "outfit_men_turtleneck.png", size: 0 }, gender: "male" },
];

const ALL_PRESET_ASSETS: PhotoAsset[] = [...PRESET_OFFICES, ...PRESET_OUTFITS].map((preset) => preset.asset);
const PRESET_BY_ID = new Map(ALL_PRESET_ASSETS.map((asset) => [asset.id, asset]));
const PRESET_BY_PATH = new Map(ALL_PRESET_ASSETS.map((asset) => [normalizeReferencePath(asset.url), asset]));

function normalizeReferencePath(reference: string): string {
    if (!reference) return "";

    if (reference.startsWith("http://") || reference.startsWith("https://")) {
        try {
            return new URL(reference).pathname;
        } catch {
            return reference;
        }
    }

    return reference.split(/[?#]/)[0];
}

export function getPresetAssetByReference(reference: string): PhotoAsset | null {
    if (!reference) return null;

    const byId = PRESET_BY_ID.get(reference);
    if (byId) return byId;

    const normalizedPath = normalizeReferencePath(reference);
    return PRESET_BY_PATH.get(normalizedPath) ?? null;
}

export function isPresetReference(reference: string): boolean {
    return getPresetAssetByReference(reference) !== null;
}
