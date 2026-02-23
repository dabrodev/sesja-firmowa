import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PhotoAsset {
    id: string;
    url: string;
    name: string;
    size: number;
}

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

interface AppState {
    currentPersona: Persona | null;
    currentOffice: Office | null;
    sessions: any[]; // Placeholder for session history

    // Actions
    setPersona: (persona: Persona | null) => void;
    setOffice: (office: Office | null) => void;
    addFaceReference: (asset: PhotoAsset) => void;
    addOfficeReference: (asset: PhotoAsset) => void;
    removeFaceReference: (id: string) => void;
    removeOfficeReference: (id: string) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
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
            sessions: [],

            setPersona: (persona) => set({ currentPersona: persona }),
            setOffice: (office) => set({ currentOffice: office }),

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
        }),
        {
            name: "corporate-session-storage",
        }
    )
);
