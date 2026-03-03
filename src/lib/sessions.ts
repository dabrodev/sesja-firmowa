import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

const DEFAULT_REQUESTED_COUNT = 4;

export interface PromptRunImagePrompt {
    index: number;
    variation: string;
    finalPrompt: string;
}

export interface PromptRunTrace {
    runId: string;
    workflowInstanceId: string;
    stylePrompt: string;
    customPrompt: string;
    prioritizeOutfit: boolean;
    imagePrompts: PromptRunImagePrompt[];
    createdAtIso: string;
}

export interface Photosession {
    id?: string;
    userId: string;
    name: string;
    status: "draft" | "processing" | "completed" | "failed";
    faceReferences: string[];
    officeReferences: string[];
    outfitReferences: string[];
    customPrompt: string;
    requestedCount: number;
    activeWorkflowInstanceId?: string | null;
    activeWorkflowRunId?: string | null;
    promptRuns: PromptRunTrace[];
    results: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function normalizeRequestedCount(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_REQUESTED_COUNT;
    return Math.min(5, Math.max(1, Math.round(value)));
}

function normalizePromptRuns(value: unknown): PromptRunTrace[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Record<string, unknown>;
        if (
            typeof candidate.runId !== "string" ||
            typeof candidate.workflowInstanceId !== "string" ||
            typeof candidate.stylePrompt !== "string"
        ) {
            return [];
        }

        const imagePrompts = Array.isArray(candidate.imagePrompts)
            ? candidate.imagePrompts.flatMap((promptItem) => {
                if (!promptItem || typeof promptItem !== "object") return [];
                const promptCandidate = promptItem as Record<string, unknown>;
                if (
                    typeof promptCandidate.index !== "number" ||
                    typeof promptCandidate.variation !== "string" ||
                    typeof promptCandidate.finalPrompt !== "string"
                ) {
                    return [];
                }
                return [{
                    index: promptCandidate.index,
                    variation: promptCandidate.variation,
                    finalPrompt: promptCandidate.finalPrompt,
                }];
            })
            : [];

        return [{
            runId: candidate.runId,
            workflowInstanceId: candidate.workflowInstanceId,
            stylePrompt: candidate.stylePrompt,
            customPrompt: typeof candidate.customPrompt === "string" ? candidate.customPrompt : "",
            prioritizeOutfit: candidate.prioritizeOutfit === true,
            imagePrompts,
            createdAtIso:
                typeof candidate.createdAtIso === "string"
                    ? candidate.createdAtIso
                    : new Date(0).toISOString(),
        }];
    });
}

function normalizeSession(docId: string, data: Record<string, unknown>): Photosession {
    const status =
        data.status === "draft" ||
        data.status === "processing" ||
        data.status === "completed" ||
        data.status === "failed"
            ? data.status
            : "draft";

    return {
        id: docId,
        userId: typeof data.userId === "string" ? data.userId : "",
        name: typeof data.name === "string" ? data.name : "Sesja bez nazwy",
        status,
        faceReferences: normalizeStringArray(data.faceReferences),
        officeReferences: normalizeStringArray(data.officeReferences),
        outfitReferences: normalizeStringArray(data.outfitReferences),
        customPrompt: typeof data.customPrompt === "string" ? data.customPrompt : "",
        requestedCount: normalizeRequestedCount(data.requestedCount),
        activeWorkflowInstanceId:
            typeof data.activeWorkflowInstanceId === "string" ? data.activeWorkflowInstanceId : undefined,
        activeWorkflowRunId:
            typeof data.activeWorkflowRunId === "string" ? data.activeWorkflowRunId : undefined,
        promptRuns: normalizePromptRuns(data.promptRuns),
        results: normalizeStringArray(data.results),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.fromMillis(0),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.fromMillis(0),
    };
}

export const sessionService = {
    async saveSession(userId: string, data: Partial<Photosession>) {
        try {
            // Compute default name based on existing sessions if not provided
            let finalName = data.name;
            if (!finalName) {
                const existing = await this.getUserSessions(userId);
                finalName = `Sesja ${existing.length + 1} (${new Date().toLocaleDateString('pl-PL')})`;
            }

            const docRef = await addDoc(collection(db, "sessions"), {
                ...data,
                userId,
                name: finalName,
                faceReferences: data.faceReferences ?? [],
                officeReferences: data.officeReferences ?? [],
                outfitReferences: data.outfitReferences ?? [],
                customPrompt: data.customPrompt ?? "",
                requestedCount: normalizeRequestedCount(data.requestedCount),
                activeWorkflowInstanceId: data.activeWorkflowInstanceId ?? null,
                activeWorkflowRunId: data.activeWorkflowRunId ?? null,
                promptRuns: data.promptRuns ?? [],
                results: data.results ?? [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: data.status || "draft",
            });
            return docRef.id;
        } catch (error) {
            console.error("Error saving session:", error);
            throw error;
        }
    },

    async updateSession(sessionId: string, data: Partial<Photosession>) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error updating session:", error);
            throw error;
        }
    },

    async appendResults(sessionId: string, newResults: string[]) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            const { arrayUnion } = await import("firebase/firestore");
            await updateDoc(docRef, {
                results: arrayUnion(...newResults),
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error appending results to session:", error);
            throw error;
        }
    },

    async upsertPromptRun(sessionId: string, promptRun: PromptRunTrace) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            const { getDoc } = await import("firebase/firestore");
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                return;
            }

            const rawData = snap.data() as Record<string, unknown>;
            const currentPromptRuns = normalizePromptRuns(rawData.promptRuns);
            const existingIndex = currentPromptRuns.findIndex((run) => run.runId === promptRun.runId);
            const nextPromptRuns =
                existingIndex >= 0
                    ? currentPromptRuns.map((run, index) => (index === existingIndex ? promptRun : run))
                    : [promptRun, ...currentPromptRuns].slice(0, 50);

            await updateDoc(docRef, {
                promptRuns: nextPromptRuns,
                updatedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error upserting prompt run:", error);
            throw error;
        }
    },

    async getUserSessions(userId: string) {
        try {
            const q = query(
                collection(db, "sessions"),
                where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            const sessions = querySnapshot.docs.map((doc) =>
                normalizeSession(doc.id, doc.data() as Record<string, unknown>)
            );

            return sessions.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });
        } catch (error) {
            console.error("Error getting user sessions:", error);
            throw error;
        }
    },

    async getSessionById(sessionId: string): Promise<Photosession | null> {
        try {
            const docRef = doc(db, "sessions", sessionId);
            const { getDoc } = await import("firebase/firestore");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return normalizeSession(docSnap.id, docSnap.data() as Record<string, unknown>);
            }
            return null;
        } catch (error) {
            console.error("Error getting session by ID:", error);
            throw error;
        }
    },

    async deleteSession(sessionId: string) {
        try {
            const docRef = doc(db, "sessions", sessionId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting session:", error);
            throw error;
        }
    }
};
