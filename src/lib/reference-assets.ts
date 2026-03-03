import type { PhotoAsset } from "./store";

export function extractR2KeyFromReference(reference: string): string | null {
    if (!reference) return null;

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
    type: "face" | "office"
): PhotoAsset {
    const key = extractR2KeyFromReference(reference);
    const filename = key?.split("/").pop() || `${type}-reference-${index + 1}.jpg`;

    return {
        id: key ?? reference,
        url: reference,
        name: filename,
        size: 0,
    };
}
