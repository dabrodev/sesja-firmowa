"use client";

import { PhotoAsset } from "./store";

const CUSTOM_GENERATOR_DRAFT_KEY = "custom-generator-draft";

export interface CustomGeneratorDraft {
    prompt: string;
    referenceAsset?: PhotoAsset;
}

export function saveCustomGeneratorDraft(draft: CustomGeneratorDraft) {
    if (typeof window === "undefined") return;

    const serializedDraft = JSON.stringify(draft);
    window.sessionStorage.setItem(CUSTOM_GENERATOR_DRAFT_KEY, serializedDraft);
    window.localStorage.setItem(CUSTOM_GENERATOR_DRAFT_KEY, serializedDraft);
}

export function consumeCustomGeneratorDraft(): CustomGeneratorDraft | null {
    if (typeof window === "undefined") return null;

    const rawDraft =
        window.sessionStorage.getItem(CUSTOM_GENERATOR_DRAFT_KEY) ||
        window.localStorage.getItem(CUSTOM_GENERATOR_DRAFT_KEY);
    if (!rawDraft) return null;

    try {
        const parsed = JSON.parse(rawDraft) as Partial<CustomGeneratorDraft>;
        const prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
        const referenceAsset = parsed.referenceAsset;

        window.sessionStorage.removeItem(CUSTOM_GENERATOR_DRAFT_KEY);
        window.localStorage.removeItem(CUSTOM_GENERATOR_DRAFT_KEY);

        if (
            referenceAsset &&
            typeof referenceAsset.id === "string" &&
            typeof referenceAsset.url === "string" &&
            typeof referenceAsset.name === "string" &&
            typeof referenceAsset.size === "number"
        ) {
            return { prompt, referenceAsset };
        }

        return { prompt };
    } catch {
        return null;
    }
}
