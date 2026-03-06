import type { Photosession } from "./sessions";
import { sessionService } from "./sessions";
import { userService } from "./users";

export const SESSION_GENERATION_COST_PER_PHOTO = 30;

type SessionGenerationAssets = {
    urls: string[];
    keys: string[];
};

type StartSessionGenerationParams = {
    userId: string;
    existingSessionId?: string | null;
    existingResultsCount?: number;
    faceReferences: SessionGenerationAssets;
    officeReferences: SessionGenerationAssets;
    outfitReferences: SessionGenerationAssets;
    customPrompt: string;
    requestedCount: number;
};

type StartSessionGenerationResult = {
    sessionId: string;
    instanceId: string;
    runId: string;
};

function getReadableError(error: unknown, fallback: string): string {
    if (!error) return fallback;
    if (error instanceof Error) return error.message || fallback;

    if (typeof error === "string") {
        const trimmed = error.trim();
        if (!trimmed) return fallback;
        try {
            const parsed = JSON.parse(trimmed) as { message?: unknown; error?: unknown };
            if (typeof parsed.message === "string" && parsed.message.trim()) {
                return parsed.message;
            }
            if (typeof parsed.error === "string" && parsed.error.trim()) {
                return parsed.error;
            }
        } catch {
            return trimmed;
        }
        return trimmed;
    }

    if (typeof error === "object") {
        const candidate = error as { message?: unknown; error?: unknown };
        if (typeof candidate.message === "string" && candidate.message.trim()) {
            return candidate.message;
        }
        if (typeof candidate.error === "string" && candidate.error.trim()) {
            return candidate.error;
        }
        try {
            return JSON.stringify(error);
        } catch {
            return fallback;
        }
    }

    return fallback;
}

function normalizeAssets(assets: SessionGenerationAssets, maxCount?: number): SessionGenerationAssets {
    const urls = assets.urls.filter((value) => typeof value === "string" && value.trim().length > 0);
    const keys = assets.keys.filter((value) => typeof value === "string" && value.trim().length > 0);

    return {
        urls: typeof maxCount === "number" ? urls.slice(0, maxCount) : urls,
        keys: typeof maxCount === "number" ? keys.slice(0, maxCount) : keys,
    };
}

export async function startSessionGeneration(
    params: StartSessionGenerationParams
): Promise<StartSessionGenerationResult> {
    const faceReferences = normalizeAssets(params.faceReferences);
    const officeReferences = normalizeAssets(params.officeReferences, 1);
    const outfitReferences = normalizeAssets(params.outfitReferences);
    const trimmedPrompt = params.customPrompt.trim();
    const requestedCount = params.requestedCount;
    const runId = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
    const cost = requestedCount * SESSION_GENERATION_COST_PER_PHOTO;

    if (faceReferences.urls.length === 0 || faceReferences.keys.length === 0) {
        throw new Error("Dodaj przynajmniej jedno zdjęcie referencyjne twarzy.");
    }

    let activeSessionId = params.existingSessionId?.trim() || null;
    let activeWorkflowInstanceId: string | null = null;
    let didChargeRunCredits = false;

    try {
        const sessionUpdatePayload = {
            faceReferences: faceReferences.urls,
            officeReferences: officeReferences.urls,
            outfitReferences: outfitReferences.urls,
            customPrompt: trimmedPrompt,
            requestedCount,
            status: "processing" as const,
            activeWorkflowInstanceId: null,
            activeWorkflowRunId: null,
        };

        if (!activeSessionId) {
            activeSessionId = await sessionService.saveSession(params.userId, {
                ...sessionUpdatePayload,
                results: [],
                name: "",
            });
        } else {
            await sessionService.reserveSessionForGeneration(activeSessionId, {
                userId: params.userId,
                faceReferences: sessionUpdatePayload.faceReferences,
                officeReferences: sessionUpdatePayload.officeReferences,
                outfitReferences: sessionUpdatePayload.outfitReferences,
                customPrompt: sessionUpdatePayload.customPrompt,
                requestedCount: sessionUpdatePayload.requestedCount,
            });
        }

        if (!activeSessionId) {
            throw new Error("Nie udało się zapisać sesji.");
        }

        await userService.deductCredits(params.userId, cost);
        didChargeRunCredits = true;

        try {
            await sessionService.markRunCharged(activeSessionId, {
                runId,
                requestedCount,
                chargedCredits: cost,
                costPerPhoto: SESSION_GENERATION_COST_PER_PHOTO,
            });
        } catch (chargeError) {
            console.warn("Failed to record run charge:", chargeError);
        }

        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: activeSessionId,
                uid: params.userId,
                faceKeys: faceReferences.keys,
                officeKeys: officeReferences.keys,
                outfitKeys: outfitReferences.keys,
                customPrompt: trimmedPrompt,
                requestedCount,
                runId,
            }),
        });

        if (!response.ok) {
            let errorMessage = "Nie udało się uruchomić generowania";
            try {
                const data = await response.json() as { error?: string };
                if (typeof data.error === "string" && data.error.trim().length > 0) {
                    errorMessage = data.error;
                }
            } catch {
                try {
                    const text = await response.text();
                    if (text.trim().length > 0) {
                        errorMessage = text.trim();
                    }
                } catch {
                    // keep default message
                }
            }
            throw new Error(errorMessage);
        }

        const { instanceId } = await response.json() as { instanceId: string };
        activeWorkflowInstanceId = instanceId;

        await sessionService.updateSession(activeSessionId, {
            activeWorkflowInstanceId: instanceId,
            activeWorkflowRunId: runId,
        });

        if (didChargeRunCredits) {
            try {
                await sessionService.markRunCharged(activeSessionId, {
                    runId,
                    workflowInstanceId: instanceId,
                    requestedCount,
                    chargedCredits: cost,
                    costPerPhoto: SESSION_GENERATION_COST_PER_PHOTO,
                });
            } catch (chargeLinkError) {
                console.warn("Failed to attach workflow instance to run billing:", chargeLinkError);
            }
        }

        return {
            sessionId: activeSessionId,
            instanceId,
            runId,
        };
    } catch (error) {
        if (activeSessionId) {
            const fallbackStatus: Photosession["status"] =
                (params.existingResultsCount ?? 0) > 0 ? "completed" : "failed";

            try {
                await sessionService.updateSession(
                    activeSessionId,
                    activeWorkflowInstanceId
                        ? {
                            status: "processing",
                            activeWorkflowInstanceId,
                            activeWorkflowRunId: runId,
                        }
                        : {
                            status: fallbackStatus,
                            activeWorkflowInstanceId: null,
                            activeWorkflowRunId: null,
                        }
                );
            } catch (updateError) {
                console.warn("Failed to restore session state after startup error:", updateError);
            }
        }

        if (didChargeRunCredits && activeSessionId && !activeWorkflowInstanceId) {
            try {
                await sessionService.settleRunBilling({
                    sessionId: activeSessionId,
                    uid: params.userId,
                    runId,
                    generatedCount: 0,
                });
            } catch (settlementError) {
                console.warn("Failed to refund credits after startup error:", settlementError);
            }
        }

        throw new Error(getReadableError(error, "Nie udało się uruchomić generowania."));
    }
}
