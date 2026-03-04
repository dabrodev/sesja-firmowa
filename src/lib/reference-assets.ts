import type { PhotoAsset } from "./store";
import { getPresetAssetByReference } from "./preset-assets";

export function extractR2KeyFromReference(reference: string): string | null {
    if (!reference) return null;

    const presetAsset = getPresetAssetByReference(reference);
    if (presetAsset) {
        return presetAsset.id;
    }

    // Support legacy/raw key values stored directly without full URL.
    if (!reference.includes("://")) {
        return reference;
    }

    try {
        const parsed = new URL(reference);
        const key = parsed.searchParams.get("key");
        return key && key.length > 0 ? key : null;
    } catch {
        return null;
    }
}

export function referenceUrlToPhotoAsset(
    reference: string,
    index: number,
    type: "face" | "office" | "outfit"
): PhotoAsset {
    const presetAsset = getPresetAssetByReference(reference);
    if (presetAsset) {
        return presetAsset;
    }

    const key = extractR2KeyFromReference(reference);
    const filename = key?.split("/").pop() || `${type}-reference-${index + 1}.jpg`;

    return {
        id: key ?? reference,
        url: reference,
        name: filename,
        size: 0,
    };
}
