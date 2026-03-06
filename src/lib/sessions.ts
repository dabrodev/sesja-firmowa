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
    Timestamp,
    runTransaction
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeRequestedCount } from "./requested-count";

const DEFAULT_COST_PER_PHOTO = 30;

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

export interface SessionRunBilling {
    runId: string;
    workflowInstanceId: string;
    requestedCount: number;
    generatedCount: number;
    chargedCredits: number;
    refundedCredits: number;
    costPerPhoto: number;
    status: "charged" | "settled";
    createdAtIso: string;
    settledAtIso?: string;
}

export interface RunBillingSettlement {
    applied: boolean;
    alreadySettled: boolean;
    requestedCount: number;
    generatedCount: number;
    chargedCredits: number;
    refundedCredits: number;
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
    runBillings: SessionRunBilling[];
    results: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function normalizePositiveInt(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.round(value));
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

function normalizeRunBillings(value: unknown): SessionRunBilling[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Record<string, unknown>;
        if (typeof candidate.runId !== "string" || candidate.runId.trim().length === 0) return [];

        const requestedCount = normalizeRequestedCount(candidate.requestedCount);
        const costPerPhoto = Math.max(1, normalizePositiveInt(candidate.costPerPhoto, DEFAULT_COST_PER_PHOTO));
        const chargedCredits = normalizePositiveInt(
            candidate.chargedCredits,
            requestedCount * costPerPhoto
        );
        const generatedCount = Math.min(
            requestedCount,
            normalizePositiveInt(candidate.generatedCount, 0)
        );
        const refundedCredits = Math.max(
            0,
            normalizePositiveInt(candidate.refundedCredits, 0)
        );
        const status = candidate.status === "settled" ? "settled" : "charged";

        return [{
            runId: candidate.runId,
            workflowInstanceId:
                typeof candidate.workflowInstanceId === "string" ? candidate.workflowInstanceId : "",
            requestedCount,
            generatedCount,
            chargedCredits,
            refundedCredits,
            costPerPhoto,
            status,
            createdAtIso:
                typeof candidate.createdAtIso === "string"
                    ? candidate.createdAtIso
                    : new Date(0).toISOString(),
            settledAtIso:
                typeof candidate.settledAtIso === "string" ? candidate.settledAtIso : undefined,
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
        runBillings: normalizeRunBillings(data.runBillings),
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
                runBillings: data.runBillings ?? [],
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

    async markRunCharged(
        sessionId: string,
        charge: {
            runId: string;
            workflowInstanceId?: string | null;
            requestedCount: number;
            chargedCredits: number;
            costPerPhoto: number;
        }
    ) {
        const runId = charge.runId.trim();
        if (!runId) return;

        const requestedCount = normalizeRequestedCount(charge.requestedCount);
        const costPerPhoto = Math.max(1, normalizePositiveInt(charge.costPerPhoto, DEFAULT_COST_PER_PHOTO));
        const chargedCredits = Math.max(
            0,
            normalizePositiveInt(charge.chargedCredits, requestedCount * costPerPhoto)
        );
        const workflowInstanceId =
            typeof charge.workflowInstanceId === "string" ? charge.workflowInstanceId.trim() : "";
        const nowIso = new Date().toISOString();

        try {
            await runTransaction(db, async (transaction) => {
                const sessionRef = doc(db, "sessions", sessionId);
                const sessionSnap = await transaction.get(sessionRef);
                if (!sessionSnap.exists()) return;

                const sessionData = sessionSnap.data() as Record<string, unknown>;
                const runBillings = normalizeRunBillings(sessionData.runBillings);
                const existingIndex = runBillings.findIndex((billing) => billing.runId === runId);
                if (existingIndex >= 0) {
                    const existing = runBillings[existingIndex];
                    const shouldPatchInstance =
                        workflowInstanceId.length > 0 && existing.workflowInstanceId !== workflowInstanceId;

                    if (!shouldPatchInstance) return;

                    const patched = runBillings.map((billing, index) =>
                        index === existingIndex
                            ? { ...billing, workflowInstanceId }
                            : billing
                    );
                    transaction.update(sessionRef, {
                        runBillings: patched,
                        updatedAt: serverTimestamp(),
                    });
                    return;
                }

                const nextRunBillings: SessionRunBilling[] = [
                    {
                        runId,
                        workflowInstanceId,
                        requestedCount,
                        generatedCount: 0,
                        chargedCredits,
                        refundedCredits: 0,
                        costPerPhoto,
                        status: "charged" as const,
                        createdAtIso: nowIso,
                    },
                    ...runBillings,
                ].slice(0, 200);

                transaction.update(sessionRef, {
                    runBillings: nextRunBillings,
                    updatedAt: serverTimestamp(),
                });
            });
        } catch (error) {
            console.error("Error recording run charge:", error);
            throw error;
        }
    },

    async settleRunBilling(params: {
        sessionId: string;
        uid: string;
        runId: string;
        generatedCount: number;
    }): Promise<RunBillingSettlement> {
        const runId = params.runId.trim();
        const safeGeneratedCount = Math.max(0, normalizePositiveInt(params.generatedCount, 0));
        if (!runId) {
            return {
                applied: false,
                alreadySettled: false,
                requestedCount: 0,
                generatedCount: 0,
                chargedCredits: 0,
                refundedCredits: 0,
            };
        }

        try {
            return await runTransaction(db, async (transaction) => {
                const sessionRef = doc(db, "sessions", params.sessionId);
                const userRef = doc(db, "users", params.uid);

                const sessionSnap = await transaction.get(sessionRef);
                if (!sessionSnap.exists()) {
                    return {
                        applied: false,
                        alreadySettled: false,
                        requestedCount: 0,
                        generatedCount: 0,
                        chargedCredits: 0,
                        refundedCredits: 0,
                    };
                }

                const sessionData = sessionSnap.data() as Record<string, unknown>;
                const sessionOwnerUid = typeof sessionData.userId === "string" ? sessionData.userId : "";
                if (sessionOwnerUid && sessionOwnerUid !== params.uid) {
                    return {
                        applied: false,
                        alreadySettled: false,
                        requestedCount: 0,
                        generatedCount: 0,
                        chargedCredits: 0,
                        refundedCredits: 0,
                    };
                }

                const runBillings = normalizeRunBillings(sessionData.runBillings);
                const existingIndex = runBillings.findIndex((billing) => billing.runId === runId);
                const existing = existingIndex >= 0 ? runBillings[existingIndex] : null;

                if (existing?.status === "settled") {
                    return {
                        applied: true,
                        alreadySettled: true,
                        requestedCount: existing.requestedCount,
                        generatedCount: existing.generatedCount,
                        chargedCredits: existing.chargedCredits,
                        refundedCredits: existing.refundedCredits,
                    };
                }

                const requestedCount = existing?.requestedCount ?? normalizeRequestedCount(sessionData.requestedCount);
                const costPerPhoto = existing?.costPerPhoto ?? DEFAULT_COST_PER_PHOTO;
                const chargedCredits = existing?.chargedCredits ?? requestedCount * costPerPhoto;
                const billableGeneratedCount = Math.min(requestedCount, safeGeneratedCount);
                const finalCost = billableGeneratedCount * costPerPhoto;
                const refundedCredits = Math.max(0, chargedCredits - finalCost);
                const workflowInstanceId = existing?.workflowInstanceId ?? "";
                const createdAtIso = existing?.createdAtIso ?? new Date().toISOString();
                const settledAtIso = new Date().toISOString();

                const settledBilling: SessionRunBilling = {
                    runId,
                    workflowInstanceId,
                    requestedCount,
                    generatedCount: billableGeneratedCount,
                    chargedCredits,
                    refundedCredits,
                    costPerPhoto,
                    status: "settled",
                    createdAtIso,
                    settledAtIso,
                };

                const nextRunBillings: SessionRunBilling[] = [
                    settledBilling,
                    ...runBillings.filter((billing) => billing.runId !== runId),
                ].slice(0, 200);

                transaction.update(sessionRef, {
                    runBillings: nextRunBillings,
                    updatedAt: serverTimestamp(),
                });

                if (refundedCredits > 0) {
                    const userSnap = await transaction.get(userRef);
                    const userData = userSnap.exists()
                        ? (userSnap.data() as Record<string, unknown>)
                        : {};
                    const currentCredits =
                        typeof userData.credits === "number" && Number.isFinite(userData.credits)
                            ? Math.max(0, Math.round(userData.credits))
                            : 0;

                    transaction.set(userRef, { credits: currentCredits + refundedCredits }, { merge: true });
                }

                return {
                    applied: true,
                    alreadySettled: false,
                    requestedCount,
                    generatedCount: billableGeneratedCount,
                    chargedCredits,
                    refundedCredits,
                };
            });
        } catch (error) {
            console.error("Error settling run billing:", error);
            throw error;
        }
    },

    async removeReferencesFromAllUserSessions(userId: string, references: string[]) {
        try {
            const uniqueReferences = Array.from(
                new Set(references.map((reference) => reference.trim()).filter((reference) => reference.length > 0))
            );
            if (uniqueReferences.length === 0) {
                return;
            }

            const q = query(
                collection(db, "sessions"),
                where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return;

            const { arrayRemove } = await import("firebase/firestore");
            await Promise.all(
                querySnapshot.docs.map(async (sessionDoc) => {
                    const sessionRef = doc(db, "sessions", sessionDoc.id);
                    await updateDoc(sessionRef, {
                        faceReferences: arrayRemove(...uniqueReferences),
                        officeReferences: arrayRemove(...uniqueReferences),
                        outfitReferences: arrayRemove(...uniqueReferences),
                        updatedAt: serverTimestamp(),
                    });
                })
            );
        } catch (error) {
            console.error("Error removing references from user sessions:", error);
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
