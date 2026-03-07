import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Photosession } from "./sessions";

export interface PhotoAsset {
    id: string;
    url: string;
    name: string;
    size: number;
}

export type AssetType = "face" | "office" | "outfit" | "generated";

export interface Persona {
    id: string;
    name: string;
    faceReferences: PhotoAsset[];
}

export interface Office {
    id: string;
    name: string;
    officeReferences: PhotoAsset[];
}

export interface Outfit {
    id: string;
    name: string;
    outfitReferences: PhotoAsset[];
}

interface AppState {
    draftOwnerUid: string | null;
    currentPersona: Persona | null;
    currentOffice: Office | null;
    currentOutfit: Outfit | null;
    sessions: Photosession[]; // Placeholder for session history

    // Actions
    setDraftOwnerUid: (uid: string | null) => void;
    setPersona: (persona: Persona | null) => void;
    setOffice: (office: Office | null) => void;
    setOutfit: (outfit: Outfit | null) => void;
    addFaceReference: (asset: PhotoAsset) => void;
    addOfficeReference: (asset: PhotoAsset) => void;
    addOutfitReference: (asset: PhotoAsset) => void;
    removeFaceReference: (id: string) => void;
    removeOfficeReference: (id: string) => void;
    removeOutfitReference: (id: string) => void;
    resetSession: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            draftOwnerUid: null,
            currentPersona: {
                id: "default-persona",
                name: "My Profile",
                faceReferences: [],
            },
            currentOffice: {
                id: "default-office",
                name: "Main Office",
                officeReferences: [],
            },
            currentOutfit: {
                id: "default-outfit",
                name: "Outfit References",
                outfitReferences: [],
            },
            sessions: [],

            setDraftOwnerUid: (uid) => set({ draftOwnerUid: uid }),
            setPersona: (persona) => set({ currentPersona: persona }),
            setOffice: (office) => set({ currentOffice: office }),
            setOutfit: (outfit) => set({ currentOutfit: outfit }),

            addFaceReference: (asset) =>
                set((state) => ({
                    currentPersona: state.currentPersona
                        ? { ...state.currentPersona, faceReferences: [...state.currentPersona.faceReferences, asset] }
                        : null
                })),

            addOfficeReference: (asset) =>
                set((state) => ({
                    currentOffice: state.currentOffice
                        ? { ...state.currentOffice, officeReferences: [...state.currentOffice.officeReferences, asset] }
                        : null
                })),

            addOutfitReference: (asset) =>
                set((state) => ({
                    currentOutfit: state.currentOutfit
                        ? { ...state.currentOutfit, outfitReferences: [...state.currentOutfit.outfitReferences, asset] }
                        : null
                })),

            removeFaceReference: (id) =>
                set((state) => ({
                    currentPersona: state.currentPersona
                        ? { ...state.currentPersona, faceReferences: state.currentPersona.faceReferences.filter(a => a.id !== id) }
                        : null
                })),

            removeOfficeReference: (id) =>
                set((state) => ({
                    currentOffice: state.currentOffice
                        ? { ...state.currentOffice, officeReferences: state.currentOffice.officeReferences.filter(a => a.id !== id) }
                        : null
                })),

            removeOutfitReference: (id) =>
                set((state) => ({
                    currentOutfit: state.currentOutfit
                        ? { ...state.currentOutfit, outfitReferences: state.currentOutfit.outfitReferences.filter(a => a.id !== id) }
                        : null
                })),

            resetSession: () =>
                set({
                    currentPersona: {
                        id: "default-persona",
                        name: "My Profile",
                        faceReferences: [],
                    },
                    currentOffice: {
                        id: "default-office",
                        name: "Main Office",
                        officeReferences: [],
                    },
                    currentOutfit: {
                        id: "default-outfit",
                        name: "Outfit References",
                        outfitReferences: [],
                    },
                }),
        }),
        {
            name: "corporate-session-storage",
        }
    )
);
