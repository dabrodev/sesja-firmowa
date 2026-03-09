"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession, PromptRunTrace } from "@/lib/sessions";
import { Calendar, ArrowLeft, Loader2, Download, ExternalLink, ImageIcon, PencilLine, Save, X, Trash2, Square, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PhotoUploader } from "@/components/photo-uploader";
import type { PhotoAsset } from "@/lib/store";
import { extractR2KeyFromReference, referenceUrlToPhotoAsset } from "@/lib/reference-assets";
import { isPresetReference } from "@/lib/preset-assets";
import { ImageWithPlaceholder } from "@/components/image-with-placeholder";
import { downloadFile } from "@/lib/download";
import { assetService } from "@/lib/assets";
import { AppHeader } from "@/components/app-header";
import { PresetSelector, PRESET_OUTFITS } from "@/components/preset-selector";
import {
    DEFAULT_REQUESTED_COUNT,
    formatPhotoCountLabel,
    getRequestedCountOptions,
} from "@/lib/requested-count";
import {
    SESSION_GENERATION_COST_PER_PHOTO,
    startSessionGeneration,
} from "@/lib/session-generation";

const STALE_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

function extractShotNumberFromUrl(url: string): number | null {
    const match = url.match(/photo-(\d+)\.jpg/i);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function countGeneratedShots(urls: string[]): number {
    const indexed = new Set<number>();
    const fallback = new Set<string>();
    for (const url of urls) {
        if (!url) continue;
        const shot = extractShotNumberFromUrl(url);
        if (shot !== null) {
            indexed.add(shot);
        } else {
            fallback.add(url);
        }
    }
    return indexed.size + fallback.size;
}

function normalizeFailedIndices(indices: unknown, requestedCount: number): number[] {
    if (!Array.isArray(indices)) return [];
    return Array.from(
        new Set(
            indices.flatMap((value) => {
                if (typeof value !== "number" || !Number.isFinite(value)) return [];
                const rounded = Math.round(value);
                if (rounded < 1 || rounded > requestedCount) return [];
                return [rounded];
            })
        )
    ).sort((a, b) => a - b);
}

function extractRunIdFromResultUrl(url: string): string | null {
    const key = extractR2KeyFromReference(url);
    if (!key) return null;

    const match = key.match(/^results\/[^/]+\/([^/]+)\/photo-\d+\.jpg$/i);
    if (!match) return null;

    return match[1] || null;
}

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const { user, userProfile, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [session, setSession] = useState<Photosession | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingReferences, setIsEditingReferences] = useState(false);
    const [isSavingReferences, setIsSavingReferences] = useState(false);
    const [faceReferencesDraft, setFaceReferencesDraft] = useState<PhotoAsset[]>([]);
    const [officeReferencesDraft, setOfficeReferencesDraft] = useState<PhotoAsset[]>([]);
    const [outfitReferencesDraft, setOutfitReferencesDraft] = useState<PhotoAsset[]>([]);
    const [customPromptDraft, setCustomPromptDraft] = useState("");
    const [requestedCountDraft, setRequestedCountDraft] = useState(DEFAULT_REQUESTED_COUNT);
    const [isSyncingResults, setIsSyncingResults] = useState(false);
    const [currentRunGeneratedCount, setCurrentRunGeneratedCount] = useState(0);
    const [currentRunFailedIndices, setCurrentRunFailedIndices] = useState<number[]>([]);
    const [deletingResultIndex, setDeletingResultIndex] = useState<number | null>(null);
    const [isDeletingSession, setIsDeletingSession] = useState(false);
    const [isForceStoppingSession, setIsForceStoppingSession] = useState(false);
    const [isQuickGenerating, setIsQuickGenerating] = useState(false);
    const [isQuickContinueDialogOpen, setIsQuickContinueDialogOpen] = useState(false);
    const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
    const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);

    const resultCount = session?.results.length ?? 0;
    const selectedResultUrl = selectedResultIndex !== null ? session?.results[selectedResultIndex] ?? null : null;
    const hasPrevResult = selectedResultIndex !== null && selectedResultIndex > 0;
    const hasNextResult = selectedResultIndex !== null && selectedResultIndex < resultCount - 1;

    const closeResultPreview = useCallback(() => {
        setIsSlideshowPlaying(false);
        setSelectedResultIndex(null);
    }, []);

    const showPrevResult = useCallback(() => {
        setSelectedResultIndex((current) => {
            if (current === null || current <= 0) return current;
            return current - 1;
        });
    }, []);

    const showNextResult = useCallback(() => {
        setSelectedResultIndex((current) => {
            if (current === null || current >= resultCount - 1) return current;
            return current + 1;
        });
    }, [resultCount]);

    const showNextResultLoop = useCallback(() => {
        setSelectedResultIndex((current) => {
            if (current === null || resultCount <= 1) return current;
            if (current >= resultCount - 1) return 0;
            return current + 1;
        });
    }, [resultCount]);

    const scrollToCurrentRun = useCallback(() => {
        const target =
            document.getElementById("current-run-anchor") ??
            document.getElementById("session-results-grid") ??
            document.getElementById("results-section");

        target?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }, []);

    const openResultEditor = useCallback((resultUrl: string) => {
        const editKey = extractR2KeyFromReference(resultUrl);
        const editParams = new URLSearchParams({
            edit: resultUrl,
            sessionId: session?.id ?? sessionId,
            ...(editKey ? { editKey } : {}),
        });
        router.push(`/wolny-generator?${editParams.toString()}`);
    }, [router, session?.id, sessionId]);

    useEffect(() => {
        if (selectedResultIndex === null) return;
        if (resultCount === 0) {
            setSelectedResultIndex(null);
            return;
        }
        if (selectedResultIndex > resultCount - 1) {
            setSelectedResultIndex(resultCount - 1);
        }
    }, [resultCount, selectedResultIndex]);

    useEffect(() => {
        if (selectedResultIndex === null) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeResultPreview();
                return;
            }
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                showPrevResult();
                return;
            }
            if (event.key === "ArrowRight") {
                event.preventDefault();
                showNextResult();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [closeResultPreview, selectedResultIndex, showNextResult, showPrevResult]);

    useEffect(() => {
        if (!isSlideshowPlaying || selectedResultIndex === null || resultCount <= 1) return;

        const timer = window.setInterval(() => {
            showNextResultLoop();
        }, 3200);

        return () => window.clearInterval(timer);
    }, [isSlideshowPlaying, selectedResultIndex, resultCount, showNextResultLoop]);

    useEffect(() => {
        if (selectedResultIndex === null || resultCount <= 1) {
            setIsSlideshowPlaying(false);
        }
    }, [selectedResultIndex, resultCount]);

    const parseDeleteError = useCallback((error: unknown): string => {
        if (error instanceof Error && error.message) return error.message;
        if (typeof error === "string" && error.trim().length > 0) return error;
        return "Nie udało się usunąć zasobu.";
    }, []);

    const deleteR2ByReference = useCallback(async (reference: string) => {
        const key = extractR2KeyFromReference(reference);
        if (!key) return;

        const response = await fetch("/api/delete-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
        });

        if (!response.ok) {
            try {
                const data = await response.json() as { error?: string };
                throw new Error(data.error || "Nie udało się usunąć pliku z chmury.");
            } catch {
                throw new Error("Nie udało się usunąć pliku z chmury.");
            }
        }
    }, []);

    useEffect(() => {
        const shouldSyncWorkflow =
            session?.status === "processing" || Boolean(session?.activeWorkflowInstanceId);
        if (!session?.id || !user || !shouldSyncWorkflow || session.status === "failed") {
            return;
        }
        const activeSessionId = session.id;
        const workflowInstanceId = session.activeWorkflowInstanceId?.trim() || "";
        const workflowRunId = session.activeWorkflowRunId || null;
        const targetStatusForManualStop: Photosession["status"] =
            session.results.length > 0 ? "completed" : "failed";

        let cancelled = false;

        const syncSessionFromWorkflow = async () => {
            if (cancelled) return;
            setIsSyncingResults(true);
            try {
                if (!workflowInstanceId) {
                    const updatedAtMillis = session.updatedAt?.toMillis?.() ?? 0;
                    const isStale = Date.now() - updatedAtMillis > STALE_PROCESSING_TIMEOUT_MS;
                    if (isStale) {
                        await sessionService.updateSession(activeSessionId, {
                            status: targetStatusForManualStop,
                            activeWorkflowInstanceId: null,
                            activeWorkflowRunId: null,
                        });
                        if (!cancelled) {
                            setSession((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        status: targetStatusForManualStop,
                                        activeWorkflowInstanceId: null,
                                        activeWorkflowRunId: null,
                                    }
                                    : prev
                            );
                        }
                    }
                    return;
                }

                const response = await fetch(
                    `/api/status?instanceId=${encodeURIComponent(workflowInstanceId)}&sessionId=${encodeURIComponent(activeSessionId)}${workflowRunId ? `&runId=${encodeURIComponent(workflowRunId)}` : ""}`,
                    { cache: "no-store" }
                );
                if (!response.ok) {
                    if (response.status === 400 || response.status === 404) {
                        await sessionService.updateSession(activeSessionId, {
                            status: targetStatusForManualStop,
                            activeWorkflowInstanceId: null,
                            activeWorkflowRunId: null,
                        });
                        if (!cancelled) {
                            setSession((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        status: targetStatusForManualStop,
                                        activeWorkflowInstanceId: null,
                                        activeWorkflowRunId: null,
                                    }
                                    : prev
                            );
                        }
                    }
                    return;
                }

                const data = await response.json() as {
                    status: "queued" | "running" | "complete" | "errored" | "terminated";
                    output?: {
                        resultUrls?: string[];
                        failedIndices?: number[];
                        promptDebug?: PromptRunTrace;
                    };
                };
                if (cancelled) return;

                const workflowResults = data.output?.resultUrls ?? [];
                const generatedCount = countGeneratedShots(workflowResults);
                const failedIndices = normalizeFailedIndices(data.output?.failedIndices, Math.max(1, session.requestedCount));
                setCurrentRunGeneratedCount(generatedCount);
                setCurrentRunFailedIndices(failedIndices);

                const promptDebug = data.output?.promptDebug;
                if (promptDebug) {
                    const alreadySaved = session.promptRuns.some((run) => run.runId === promptDebug.runId);
                    if (!alreadySaved) {
                        await sessionService.upsertPromptRun(activeSessionId, promptDebug);
                        if (!cancelled) {
                            setSession((prev) => {
                                if (!prev) return prev;
                                if (prev.promptRuns.some((run) => run.runId === promptDebug.runId)) return prev;
                                return { ...prev, promptRuns: [promptDebug, ...prev.promptRuns].slice(0, 50) };
                            });
                        }
                    }
                }

                const mergedResults = workflowResults.length > 0
                    ? Array.from(new Set([...(session.results || []), ...workflowResults]))
                    : (session.results || []);
                const hasNewResults = mergedResults.length !== session.results.length;

                if (data.status === "complete") {
                    if (workflowRunId) {
                        try {
                            await sessionService.settleRunBilling({
                                sessionId: activeSessionId,
                                uid: user.uid,
                                runId: workflowRunId,
                                generatedCount,
                            });
                        } catch (settlementError) {
                            console.warn("Failed to settle completed run billing:", settlementError);
                        }
                    }
                    const shouldFinalize =
                        hasNewResults ||
                        session.status !== "completed" ||
                        Boolean(session.activeWorkflowInstanceId) ||
                        Boolean(session.activeWorkflowRunId);

                    if (shouldFinalize) {
                        await sessionService.updateSession(activeSessionId, {
                            status: "completed",
                            results: mergedResults,
                            activeWorkflowInstanceId: null,
                            activeWorkflowRunId: null,
                        });
                        if (!cancelled) {
                            setSession((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        status: "completed",
                                        results: mergedResults,
                                        activeWorkflowInstanceId: null,
                                        activeWorkflowRunId: null,
                                    }
                                    : prev
                            );
                        }
                    }
                    setCurrentRunGeneratedCount(0);
                    setCurrentRunFailedIndices([]);
                    return;
                }

                if (data.status === "errored" || data.status === "terminated") {
                    if (workflowRunId) {
                        try {
                            await sessionService.settleRunBilling({
                                sessionId: activeSessionId,
                                uid: user.uid,
                                runId: workflowRunId,
                                generatedCount,
                            });
                        } catch (settlementError) {
                            console.warn("Failed to settle terminal run billing:", settlementError);
                        }
                    }
                    const terminalStatus: Photosession["status"] = generatedCount > 0 ? "completed" : "failed";
                    await sessionService.updateSession(activeSessionId, {
                        status: terminalStatus,
                        results: mergedResults,
                        activeWorkflowInstanceId: null,
                        activeWorkflowRunId: null,
                    });
                    if (!cancelled) {
                        setSession((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    status: terminalStatus,
                                    results: mergedResults,
                                    activeWorkflowInstanceId: null,
                                    activeWorkflowRunId: null,
                                }
                                : prev
                        );
                    }
                    setCurrentRunGeneratedCount(0);
                    setCurrentRunFailedIndices([]);
                    return;
                }

                if (hasNewResults) {
                    await sessionService.updateSession(activeSessionId, {
                        status: "processing",
                        results: mergedResults,
                        activeWorkflowInstanceId: workflowInstanceId,
                        activeWorkflowRunId: workflowRunId,
                    });
                    if (!cancelled) {
                        setSession((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    status: "processing",
                                    results: mergedResults,
                                    activeWorkflowInstanceId: workflowInstanceId,
                                    activeWorkflowRunId: workflowRunId,
                                }
                                : prev
                        );
                    }
                }
            } catch (error) {
                console.warn("Workflow sync failed:", error);
            } finally {
                if (!cancelled) {
                    setIsSyncingResults(false);
                }
            }
        };

        void syncSessionFromWorkflow();
        const interval = setInterval(() => {
            void syncSessionFromWorkflow();
        }, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [
        session?.id,
        session?.status,
        session?.results,
        session?.requestedCount,
        session?.activeWorkflowInstanceId,
        session?.activeWorkflowRunId,
        session?.updatedAt,
        session?.promptRuns,
        user
    ]);

    const resetReferenceDraft = useCallback((sessionData: Photosession) => {
        setFaceReferencesDraft(
            sessionData.faceReferences.map((reference, index) => referenceUrlToPhotoAsset(reference, index, "face"))
        );
        setOfficeReferencesDraft(
            sessionData.officeReferences.slice(0, 1).map((reference, index) => referenceUrlToPhotoAsset(reference, index, "office"))
        );
        setOutfitReferencesDraft(
            sessionData.outfitReferences.map((reference, index) => referenceUrlToPhotoAsset(reference, index, "outfit"))
        );
        setCustomPromptDraft(sessionData.customPrompt);
        setRequestedCountDraft(sessionData.requestedCount);
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/login?callbackUrl=/sesje/${sessionId}`);
            return;
        }

        if (user && sessionId) {
            const fetchSession = async () => {
                try {
                    const data = await sessionService.getSessionById(sessionId);
                    if (!data || data.userId !== user.uid) {
                        router.push(`/sesje`);
                        return;
                    }
                    const userAssets = await assetService.getAllUserAssets(user.uid);
                    const validReferenceUrls = new Set(userAssets.map((asset) => asset.url));
                    const validReferenceKeys = new Set(userAssets.map((asset) => asset.id));
                    const isKnownReference = (reference: string) => {
                        if (isPresetReference(reference)) return true;
                        if (validReferenceUrls.has(reference)) return true;
                        const key = extractR2KeyFromReference(reference);
                        return Boolean(key && validReferenceKeys.has(key));
                    };
                    const sanitizedFaceReferences = data.faceReferences.filter((reference) => isKnownReference(reference));
                    const sanitizedOfficeReferences = data.officeReferences.filter((reference) => isKnownReference(reference));
                    const sanitizedOutfitReferences = data.outfitReferences.filter((reference) => isKnownReference(reference));
                    const hasReferenceMismatch =
                        sanitizedFaceReferences.length !== data.faceReferences.length ||
                        sanitizedOfficeReferences.length !== data.officeReferences.length ||
                        sanitizedOutfitReferences.length !== data.outfitReferences.length;

                    const sanitizedData: Photosession = hasReferenceMismatch
                        ? {
                            ...data,
                            faceReferences: sanitizedFaceReferences,
                            officeReferences: sanitizedOfficeReferences,
                            outfitReferences: sanitizedOutfitReferences,
                        }
                        : data;

                    const patch: Partial<Photosession> = {};
                    if (hasReferenceMismatch) {
                        patch.faceReferences = sanitizedFaceReferences;
                        patch.officeReferences = sanitizedOfficeReferences;
                        patch.outfitReferences = sanitizedOutfitReferences;
                    }

                    const hasWorkflowBinding = Boolean(
                        (sanitizedData.activeWorkflowInstanceId?.trim() || "") ||
                        sanitizedData.activeWorkflowRunId
                    );
                    const shouldHealStaleProcessing =
                        sanitizedData.status === "processing" &&
                        sanitizedData.results.length > 0 &&
                        !hasWorkflowBinding;
                    if (shouldHealStaleProcessing) {
                        patch.status = "completed";
                        patch.activeWorkflowInstanceId = null;
                        patch.activeWorkflowRunId = null;
                    }

                    if (sanitizedData.id && Object.keys(patch).length > 0) {
                        await sessionService.updateSession(sanitizedData.id, patch);
                    }

                    const normalizedSession = Object.keys(patch).length > 0
                        ? { ...sanitizedData, ...patch }
                        : sanitizedData;

                    setSession(normalizedSession);
                    resetReferenceDraft(normalizedSession);
                } catch (error) {
                    console.error("Error fetching session:", error);
                    router.push(`/sesje`);
                } finally {
                    setLoading(false);
                }
            };
            fetchSession();
        }
    }, [user, authLoading, router, sessionId, resetReferenceDraft]);

    const handleSaveReferences = async () => {
        if (!session?.id) return;

        if (faceReferencesDraft.length === 0) {
            alert("Dodaj przynajmniej jedno zdjęcie wizerunkowe.");
            return;
        }

        const updatedFaceReferences = faceReferencesDraft.map((asset) => asset.url);
        const updatedOfficeReferences = officeReferencesDraft.slice(0, 1).map((asset) => asset.url);
        const updatedOutfitReferences = outfitReferencesDraft.map((asset) => asset.url);
        const updatedCustomPrompt = customPromptDraft.trim();

        setIsSavingReferences(true);
        try {
            await sessionService.updateSession(session.id, {
                faceReferences: updatedFaceReferences,
                officeReferences: updatedOfficeReferences,
                outfitReferences: updatedOutfitReferences,
                customPrompt: updatedCustomPrompt,
                requestedCount: requestedCountDraft,
            });

            setSession((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    faceReferences: updatedFaceReferences,
                    officeReferences: updatedOfficeReferences,
                    outfitReferences: updatedOutfitReferences,
                    customPrompt: updatedCustomPrompt,
                    requestedCount: requestedCountDraft,
                };
            });

            setIsEditingReferences(false);
        } catch (error) {
            console.error("Error updating references:", error);
            alert("Nie udało się zapisać zmian materiałów. Spróbuj ponownie.");
        } finally {
            setIsSavingReferences(false);
        }
    };

    const handleDownload = async (url: string, index: number) => {
        try {
            await downloadFile(url, `sesja-${session?.id}-photo-${index + 1}.jpg`);
        } catch (error) {
            console.error("Error downloading image:", error);
            alert("Nie udało się pobrać zdjęcia. Spróbuj ponownie za chwilę.");
        }
    };

    const handleDeleteResult = async (index: number) => {
        if (!session?.id || !session.results[index]) return;
        if (session.status === "processing") {
            alert("Nie można usuwać zdjęć w trakcie aktywnego generowania.");
            return;
        }

        const confirmed = confirm("Usunąć to zdjęcie z sesji? Plik zostanie usunięty z Cloudflare R2 tylko jeśli nie jest zapisany w materiałach.");
        if (!confirmed) return;

        const targetUrl = session.results[index];
        setDeletingResultIndex(index);
        try {
            const isSavedInMaterials = user ? await assetService.hasUserAssetReference(user.uid, targetUrl) : false;
            if (!isSavedInMaterials) {
                await deleteR2ByReference(targetUrl);
            }
            const nextResults = session.results.filter((_, resultIndex) => resultIndex !== index);
            await sessionService.updateSession(session.id, { results: nextResults });
            setSession((prev) => (prev ? { ...prev, results: nextResults } : prev));
        } catch (error) {
            console.error("Error deleting session result:", error);
            alert(parseDeleteError(error));
        } finally {
            setDeletingResultIndex(null);
        }
    };

    const handleDeleteSession = async () => {
        if (!session?.id) return;
        if (session.status === "processing") {
            alert("Najpierw zatrzymaj aktywne generowanie (Wymuś zatrzymanie), a potem usuń sesję.");
            return;
        }

        const confirmed = confirm("Usunąć całą sesję? Zdjęcia niezapisane w materiałach zostaną usunięte także z Cloudflare R2.");
        if (!confirmed) return;

        setIsDeletingSession(true);
        try {
            for (const url of session.results) {
                try {
                    const isSavedInMaterials = user ? await assetService.hasUserAssetReference(user.uid, url) : false;
                    if (!isSavedInMaterials) {
                        await deleteR2ByReference(url);
                    }
                } catch (error) {
                    console.warn("Failed to delete result from R2:", error);
                }
            }

            await sessionService.deleteSession(session.id);
            router.push("/sesje");
        } catch (error) {
            console.error("Error deleting session:", error);
            alert(parseDeleteError(error));
        } finally {
            setIsDeletingSession(false);
        }
    };

    const handleForceStopSession = async () => {
        if (!user || !session?.id || session.status !== "processing") return;

        const confirmed = confirm(
            "Wymusić zatrzymanie tej sesji? Workflow zostanie odłączony od sesji, a sesję będzie można usunąć lub kontynuować ręcznie."
        );
        if (!confirmed) return;

        const targetStatus: Photosession["status"] =
            session.results.length > 0 ? "completed" : "failed";

        setIsForceStoppingSession(true);
        try {
            if (session.activeWorkflowRunId) {
                try {
                    await sessionService.settleRunBilling({
                        sessionId: session.id,
                        uid: user.uid,
                        runId: session.activeWorkflowRunId,
                        generatedCount: currentRunGeneratedCount,
                    });
                } catch (settlementError) {
                    console.warn("Failed to settle run billing during force stop:", settlementError);
                }
            }
            await sessionService.updateSession(session.id, {
                status: targetStatus,
                activeWorkflowInstanceId: null,
                activeWorkflowRunId: null,
            });
            setSession((prev) =>
                prev
                    ? {
                        ...prev,
                        status: targetStatus,
                        activeWorkflowInstanceId: null,
                        activeWorkflowRunId: null,
                    }
                    : prev
            );
            setCurrentRunGeneratedCount(0);
            setCurrentRunFailedIndices([]);
        } catch (error) {
            console.error("Error force stopping session:", error);
            alert("Nie udało się zatrzymać sesji. Spróbuj ponownie.");
        } finally {
            setIsForceStoppingSession(false);
        }
    };

    const openParametersEditor = useCallback(() => {
        if (!session) return;

        resetReferenceDraft(session);
        setIsEditingReferences(true);

        requestAnimationFrame(() => {
            document.getElementById("session-parameters")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    }, [resetReferenceDraft, session]);

    const handleQuickContinueSession = async () => {
        if (!user || !session?.id || session.status === "processing" || isQuickGenerating || isEditingReferences) return;

        const quickGenerationCost = session.requestedCount * SESSION_GENERATION_COST_PER_PHOTO;
        const availableCredits = userProfile?.credits ?? 0;
        const missingCredits = Math.max(0, quickGenerationCost - availableCredits);

        if (availableCredits < quickGenerationCost) {
            alert(`Brakuje ${missingCredits} PKT, aby dodać kolejne zdjęcia na tych samych ustawieniach.`);
            return;
        }

        setIsQuickGenerating(true);
        try {
            const startedRun = await startSessionGeneration({
                userId: user.uid,
                existingSessionId: session.id,
                existingResultsCount: session.results.length,
                faceReferences: {
                    urls: session.faceReferences,
                    keys: session.faceReferences
                        .map((reference) => extractR2KeyFromReference(reference))
                        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
                },
                officeReferences: {
                    urls: session.officeReferences.slice(0, 1),
                    keys: session.officeReferences
                        .slice(0, 1)
                        .map((reference) => extractR2KeyFromReference(reference))
                        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
                },
                outfitReferences: {
                    urls: session.outfitReferences,
                    keys: session.outfitReferences
                        .map((reference) => extractR2KeyFromReference(reference))
                        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
                },
                customPrompt: session.customPrompt,
                requestedCount: session.requestedCount,
            });

            setSession((prev) =>
                prev
                    ? {
                        ...prev,
                        status: "processing",
                        activeWorkflowInstanceId: startedRun.instanceId,
                        activeWorkflowRunId: startedRun.runId,
                    }
                    : prev
            );
            setCurrentRunGeneratedCount(0);
            setCurrentRunFailedIndices([]);

            requestAnimationFrame(() => {
                scrollToCurrentRun();
            });
        } catch (error) {
            console.error("Error starting quick continuation:", error);
            alert(error instanceof Error ? error.message : "Nie udało się uruchomić kolejnej generacji.");
        } finally {
            setIsQuickGenerating(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!session || !user) return null;

    const quickGenerationCost = session.requestedCount * SESSION_GENERATION_COST_PER_PHOTO;
    const availableQuickCredits = userProfile?.credits ?? 0;
    const missingQuickCredits = Math.max(0, quickGenerationCost - availableQuickCredits);
    const hasEnoughCreditsForQuickContinue = availableQuickCredits >= quickGenerationCost;

    const noResultsTitle =
        session.status === "failed"
            ? "Generowanie zakończone błędem"
            : session.status === "completed"
                ? "Workflow zakończony, trwa synchronizacja wyników"
                : "Sesja w trakcie generowania";
    const noResultsDescription =
        session.status === "failed"
            ? "Nie udało się pobrać wyników z workflow. Uruchom kontynuację sesji ponownie."
            : isSyncingResults
                ? "Sprawdzamy workflow i pobieramy gotowe zdjęcia do tej sesji..."
                : "To może potrwać kilka minut. Odśwież stronę za moment, aby sprawdzić wyniki.";
    const latestPromptRun = session.promptRuns[0] ?? null;
    const isProcessing = session.status === "processing";
    const expectedCurrentRunCount = isProcessing ? Math.max(1, session.requestedCount) : 0;
    const currentRunFailedCount = isProcessing ? currentRunFailedIndices.length : 0;
    const currentRunProcessedCount = isProcessing
        ? Math.min(expectedCurrentRunCount, currentRunGeneratedCount + currentRunFailedCount)
        : 0;
    const missingCurrentRunCount = isProcessing
        ? Math.max(expectedCurrentRunCount - currentRunProcessedCount, 0)
        : 0;
    const currentRunProgressPercent = expectedCurrentRunCount
        ? Math.min(100, Math.round((currentRunProcessedCount / expectedCurrentRunCount) * 100))
        : 0;
    const requestedCountOptions = getRequestedCountOptions(requestedCountDraft);
    const missingRunShotNumbers = isProcessing
        ? Array.from({ length: expectedCurrentRunCount }, (_, index) => index + 1).filter(
            (shotNumber) => !currentRunFailedIndices.includes(shotNumber)
        ).slice(currentRunGeneratedCount)
        : [];
    const activeRunId = session.activeWorkflowRunId?.trim() || "";
    const firstCurrentRunResultIndex =
        isProcessing && activeRunId
            ? session.results.findIndex((url) => extractRunIdFromResultUrl(url) === activeRunId)
            : -1;

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans pb-20">
            <AppHeader user={user} userProfile={userProfile} onLogout={logout} sticky />

            <main className="container mx-auto px-6 py-8">
                <div className="mb-6">
                    <Link href={`/sesje`}>
                        <Button variant="ghost" className="-ml-4 text-zinc-400 hover:bg-white/5 hover:text-white">
                            <ArrowLeft className="mr-2 h-4 w-4" /> wszystkie sesje
                        </Button>
                    </Link>
                </div>
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border",
                                session.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            )}>
                                {session.status === 'completed' ? 'Ukończono' : session.status}
                            </span>
                            <div className="text-sm text-zinc-400 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {session.createdAt?.toDate().toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })}
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">Twoja sesja biznesowa</h1>
                        <p className="text-zinc-500 text-sm mt-1 font-mono">ID: {session.id}</p>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="flex flex-wrap gap-2">
                            <Button
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                                onClick={() => setIsQuickContinueDialogOpen(true)}
                                disabled={session.status === "processing" || isQuickGenerating || isEditingReferences || !hasEnoughCreditsForQuickContinue}
                            >
                                {isQuickGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Dodaj więcej zdjęć (+{session.requestedCount})
                            </Button>
                            <Button
                                variant="outline"
                                className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                onClick={openParametersEditor}
                                disabled={isSavingReferences || isQuickGenerating}
                            >
                                <PencilLine className="mr-2 h-4 w-4" />
                                Zmień parametry
                            </Button>
                            {session.status === "processing" ? (
                                <Button
                                    variant="outline"
                                    className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
                                    onClick={() => void handleForceStopSession()}
                                    disabled={isForceStoppingSession || isDeletingSession || isQuickGenerating}
                                >
                                    {isForceStoppingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                                    Wymuś zatrzymanie
                                </Button>
                            ) : null}
                            <Button
                                variant="outline"
                                className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                                onClick={() => void handleDeleteSession()}
                                disabled={isDeletingSession || session.status === "processing" || isQuickGenerating}
                            >
                                {isDeletingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Usuń sesję
                            </Button>
                        </div>
                        {!hasEnoughCreditsForQuickContinue && session.status !== "processing" ? (
                            <p className="mt-3 text-right text-xs text-red-200">
                                Brakuje {missingQuickCredits} PKT, aby dodać więcej zdjęć bez zmiany parametrów.
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Results Column (Takes up 2/3 on desktop) */}
                    <div id="results-section" className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-blue-400" />
                            Wygenerowane Fotografie
                        </h2>

                        {isProcessing ? (
                            <Card className="border-blue-500/20 bg-blue-500/10">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-blue-100">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="font-medium">Sesja aktywna: trwa generowanie</span>
                                    </div>
                                    <p className="text-sm text-zinc-200">
                                        W tej kontynuacji wygenerowano już
                                        {" "}
                                        <span className="font-semibold text-white">{currentRunGeneratedCount}</span>
                                        {" "}
                                        z
                                        {" "}
                                        <span className="font-semibold text-white">{expectedCurrentRunCount}</span>
                                        {" "}
                                        zdjęć.
                                    </p>
                                    {currentRunFailedCount > 0 ? (
                                        <p className="text-xs text-red-200">
                                            Nieudane ujęcia w tym runie: {currentRunFailedIndices.join(", ")}.
                                        </p>
                                    ) : null}
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                                            style={{ width: `${currentRunProgressPercent}%` }}
                                        />
                                    </div>
                                    <div className="pt-1">
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-blue-400/30 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 hover:text-white"
                                                onClick={scrollToCurrentRun}
                                            >
                                                Przejdź do zdjęć
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
                                                onClick={() => void handleForceStopSession()}
                                                disabled={isForceStoppingSession || isDeletingSession}
                                            >
                                                {isForceStoppingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                                                Wymuś zatrzymanie tej sesji
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}

                        {session.results.length === 0 && !isProcessing ? (
                            <Card className="border-white/10 bg-white/5 backdrop-blur-xl border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                    {session.status !== "failed" ? (
                                        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                                    ) : (
                                        <ImageIcon className="h-10 w-10 text-zinc-500 mb-4" />
                                    )}
                                    <h3 className="text-lg font-medium text-white">{noResultsTitle}</h3>
                                    <p className="text-zinc-400 max-w-sm mt-2">{noResultsDescription}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div id="session-results-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {session.results.map((url, i) => (
                                    <motion.div
                                        key={i}
                                        id={i === firstCurrentRunResultIndex ? "current-run-anchor" : undefined}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[3/4] cursor-zoom-in"
                                        onClick={() => setSelectedResultIndex(i)}
                                    >
                                        <ImageWithPlaceholder
                                            src={url}
                                            alt={`Generated shot ${i + 1}`}
                                            className="w-full h-full object-cover"
                                            fallbackLabel="Zdjęcie niedostępne"
                                        />

                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                            <div className="flex gap-2 w-full">
                                                <Button
                                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void handleDownload(url, i);
                                                    }}
                                                >
                                                    <Download className="mr-2 h-4 w-4" /> Pobierz HD
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="bg-emerald-600/80 hover:bg-emerald-500 text-white backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openResultEditor(url);
                                                    }}
                                                    title="Edytuj to zdjęcie"
                                                >
                                                    <PencilLine className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(url, "_blank");
                                                    }}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="bg-red-600/80 hover:bg-red-500 text-white backdrop-blur-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void handleDeleteResult(i);
                                                    }}
                                                    disabled={deletingResultIndex === i || session.status === "processing" || isDeletingSession}
                                                >
                                                    {deletingResultIndex === i ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {isProcessing
                                    ? (
                                        <>
                                            {currentRunFailedIndices.map((failedIndex) => (
                                                <div
                                                    key={`failed-${failedIndex}`}
                                                    id={
                                                        firstCurrentRunResultIndex === -1 && failedIndex === currentRunFailedIndices[0]
                                                            ? "current-run-anchor"
                                                            : undefined
                                                    }
                                                    className="relative rounded-2xl overflow-hidden border border-dashed border-red-500/40 bg-red-500/10 aspect-[3/4] flex items-center justify-center"
                                                >
                                                    <div className="text-center px-4">
                                                        <div className="mx-auto mb-2 h-3 w-3 rounded-full bg-red-300" />
                                                        <p className="text-xs text-red-100">
                                                            Ujęcie {failedIndex}/{expectedCurrentRunCount} nieudane
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {Array.from({ length: missingCurrentRunCount }).map((_, idx) => {
                                                const shotNumber = missingRunShotNumbers[idx]
                                                    ?? Math.min(currentRunProcessedCount + idx + 1, expectedCurrentRunCount);
                                                return (
                                                    <div
                                                        key={`placeholder-${idx}`}
                                                        id={
                                                            firstCurrentRunResultIndex === -1 &&
                                                            currentRunFailedIndices.length === 0 &&
                                                            idx === 0
                                                                ? "current-run-anchor"
                                                                : undefined
                                                        }
                                                        className="relative rounded-2xl overflow-hidden border border-dashed border-blue-500/30 bg-blue-500/5 aspect-[3/4] flex items-center justify-center"
                                                    >
                                                        <div className="text-center">
                                                            <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto mb-2" />
                                                            <p className="text-xs text-blue-100">
                                                                Generowanie
                                                                {" "}
                                                                {shotNumber}
                                                                /
                                                                {expectedCurrentRunCount}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )
                                    : null}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Reference Column */}
                    <div id="session-parameters" className="space-y-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">Użyte materiały</h2>
                            {!isEditingReferences ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                    onClick={openParametersEditor}
                                >
                                    <PencilLine className="mr-2 h-4 w-4" /> Zmień parametry
                                </Button>
                            ) : null}
                        </div>
                        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                            <CardContent className="p-6 space-y-8">
                                {isEditingReferences ? (
                                    <>
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                                            Możesz podmienić materiały i kontynuować tę samą sesję. Lokacja biurowa jest opcjonalna, ale jeśli ją dodasz, ograniczamy do 1 zdjęcia, żeby uniknąć miksowania pomieszczeń.
                                        </div>

                                        <PhotoUploader
                                            title="Zdjęcia Wizerunkowe"
                                            description="Wymień zdjęcia twarzy/postaci, które mają być użyte przy kolejnych dogenerowaniach."
                                            assets={faceReferencesDraft}
                                            onUpload={(asset) => setFaceReferencesDraft((prev) => [...prev, asset])}
                                            onRemove={(id) => setFaceReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={10}
                                            userId={user.uid}
                                            assetType="face"
                                            galleryTypes={["face", "generated"]}
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <PhotoUploader
                                            title="Lokacja Biurowa (opcjonalnie)"
                                            description="Dodaj naturalne zdjęcie biura dla kolejnych ujęć tej sesji albo opisz miejsce w prompcie."
                                            assets={officeReferencesDraft}
                                            onUpload={(asset) => setOfficeReferencesDraft([asset])}
                                            onRemove={(id) => setOfficeReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={1}
                                            userId={user.uid}
                                            assetType="office"
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <PresetSelector
                                            title="Przykładowe stylizacje (opcjonalnie)"
                                            description="Wybierz styl, który najbardziej pasuje do klimatu kolejnych zdjęć."
                                            presets={PRESET_OUTFITS}
                                            selectedAssets={outfitReferencesDraft}
                                            onSelect={(asset) => setOutfitReferencesDraft((prev) => [...prev, asset])}
                                            onDeselect={(id) =>
                                                setOutfitReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))
                                            }
                                            multiple={true}
                                            showGenderFilter={true}
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <PhotoUploader
                                            title="Referencje Ubioru (opcjonalnie)"
                                            description="Dodaj ubrania/stylizacje, aby utrzymać spójny dress code przy kontynuacji sesji."
                                            assets={outfitReferencesDraft}
                                            onUpload={(asset) => setOutfitReferencesDraft((prev) => [...prev, asset])}
                                            onRemove={(id) => setOutfitReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={6}
                                            userId={user.uid}
                                            assetType="outfit"
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                                    Liczba zdjęć w kolejnej kontynuacji
                                                </label>
                                                <Select
                                                    value={String(requestedCountDraft)}
                                                    onValueChange={(value) => setRequestedCountDraft(Number(value))}
                                                >
                                                    <SelectTrigger className="h-11 border-white/10 bg-white/5 text-white">
                                                        <SelectValue placeholder="Wybierz liczbę zdjęć" />
                                                    </SelectTrigger>
                                                    <SelectContent className="border-white/10 bg-[#0f172a] text-white">
                                                        {requestedCountOptions.map((value) => (
                                                            <SelectItem key={value} value={String(value)}>
                                                                {formatPhotoCountLabel(value)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <label htmlFor="session-prompt-draft" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                                    Prompt tekstowy (opcjonalnie)
                                                </label>
                                                <Textarea
                                                    id="session-prompt-draft"
                                                    value={customPromptDraft}
                                                    onChange={(e) => setCustomPromptDraft(e.target.value)}
                                                    placeholder="Np. osoba stojąca bokiem, formalna koszula, naturalny newsroom look."
                                                    className="min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                                                />
                                                <p className="text-xs text-zinc-500">
                                                    Ten prompt ma najwyższy priorytet. Jeśli zostawisz puste pole, użyjemy domyślnego ustawienia kadru i stylu.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                className="text-zinc-300 hover:bg-white/5 hover:text-white"
                                                onClick={() => {
                                                    resetReferenceDraft(session);
                                                    setIsEditingReferences(false);
                                                }}
                                            >
                                                <X className="mr-2 h-4 w-4" /> Anuluj
                                            </Button>
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={handleSaveReferences}
                                                disabled={isSavingReferences}
                                            >
                                                {isSavingReferences ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Zapisz materiały
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-medium text-zinc-300">Zdjęcia Wizerunkowe</span>
                                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.faceReferences.length}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {session.faceReferences.map((url, i) => (
                                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                        <ImageWithPlaceholder
                                                            src={url}
                                                            className="w-full h-full object-cover"
                                                            alt="Face ref"
                                                            fallbackLabel="Zdjęcie usunięte"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-medium text-zinc-300">Lokacje Biurowe</span>
                                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.officeReferences.length}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {session.officeReferences.map((url, i) => (
                                                    <div key={i} className="aspect-video rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                        <ImageWithPlaceholder
                                                            src={url}
                                                            className="w-full h-full object-cover"
                                                            alt="Office ref"
                                                            fallbackLabel="Zdjęcie usunięte"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-medium text-zinc-300">Referencje Ubioru</span>
                                                <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.outfitReferences.length}</span>
                                            </div>
                                            {session.outfitReferences.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {session.outfitReferences.map((url, i) => (
                                                        <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                            <ImageWithPlaceholder
                                                                src={url}
                                                                className="w-full h-full object-cover"
                                                                alt="Outfit ref"
                                                                fallbackLabel="Zdjęcie usunięte"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zinc-500">Brak referencji ubioru. Możesz je dodać w trybie edycji.</p>
                                            )}
                                        </div>

                                        <div className="h-px bg-white/10 w-full" />

                                        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs uppercase tracking-wide text-zinc-500">Parametry kolejnej kontynuacji</div>
                                            <div className="text-sm text-zinc-300">
                                                Liczba zdjęć: <span className="font-medium text-white">{session.requestedCount}</span>
                                            </div>
                                            <div className="text-sm text-zinc-300">
                                                Prompt:{" "}
                                                <span className="text-white">
                                                    {session.customPrompt ? session.customPrompt : "brak (użyty zostanie prompt bazowy)"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs uppercase tracking-wide text-zinc-500">Podgląd promptów workflow</div>
                                            {latestPromptRun ? (
                                                <>
                                                    <div className="text-xs text-zinc-400">
                                                        Run: <span className="font-mono text-zinc-300">{latestPromptRun.runId}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="text-xs text-zinc-500">Prompt bazowy (systemowy dla sesji)</div>
                                                        <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-zinc-950/70 p-2 text-xs text-zinc-200">
                                                            {latestPromptRun.stylePrompt}
                                                        </pre>
                                                    </div>
                                                    {latestPromptRun.imagePrompts.map((imagePrompt) => (
                                                        <details
                                                            key={`${latestPromptRun.runId}-${imagePrompt.index}`}
                                                            className="rounded-lg border border-white/10 bg-zinc-950/70 p-2"
                                                        >
                                                            <summary className="cursor-pointer text-xs font-medium text-zinc-300">
                                                                Prompt zdjęcia {imagePrompt.index}
                                                            </summary>
                                                            <p className="mt-2 text-[11px] text-zinc-500">{imagePrompt.variation}</p>
                                                            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-200">
                                                                {imagePrompt.finalPrompt}
                                                            </pre>
                                                        </details>
                                                    ))}
                                                </>
                                            ) : (
                                                <p className="text-xs text-zinc-500">
                                                    Brak zapisanych promptów dla tej sesji. Pojawią się po zakończeniu kolejnej generacji.
                                                </p>
                                            )}
                                        </div>

                                        {session.officeReferences.length > 1 ? (
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                                                W tej sesji zapisano wiele lokacji biurowych. Przy kolejnych generacjach zalecamy zostawić tylko jedną, żeby uniknąć mieszania tła.
                                            </div>
                                        ) : null}

                                        <div className="flex flex-col gap-2">
                                            <Button
                                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500"
                                                onClick={() => setIsQuickContinueDialogOpen(true)}
                                                disabled={session.status === "processing" || isQuickGenerating || isEditingReferences || !hasEnoughCreditsForQuickContinue}
                                            >
                                                {isQuickGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Dodaj więcej zdjęć (+{session.requestedCount})
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                                onClick={openParametersEditor}
                                                disabled={isSavingReferences || isQuickGenerating}
                                            >
                                                <PencilLine className="mr-2 h-4 w-4" />
                                                Kontynuuj z nowymi parametrami
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            <AlertDialog open={isQuickContinueDialogOpen} onOpenChange={setIsQuickContinueDialogOpen}>
                <AlertDialogContent className="border-white/10 bg-[#0b1120] text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Dodaj więcej zdjęć?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-300">
                            Uruchomimy kolejny run na tych samych materiałach i tym samym prompcie.
                            Koszt tej akcji to <span className="font-semibold text-white">{quickGenerationCost} PKT</span> za pakiet{" "}
                            <span className="font-semibold text-white">{formatPhotoCountLabel(session.requestedCount)}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                            Anuluj
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-blue-600 text-white hover:bg-blue-500"
                            onClick={() => {
                                void handleQuickContinueSession();
                            }}
                        >
                            Dodaj więcej zdjęć
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AnimatePresence>
                {selectedResultUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeResultPreview}
                        className="fixed inset-0 z-[100] bg-black/70 p-4 backdrop-blur-sm md:p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Podgląd zdjęcia ${Math.max(1, (selectedResultIndex ?? 0) + 1)} z ${Math.max(1, resultCount)}`}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative mx-auto flex h-full w-full max-w-5xl items-center justify-center rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl md:p-6"
                        >
                            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
                                {resultCount > 1 ? (
                                    <Button
                                        variant="secondary"
                                        onClick={() => setIsSlideshowPlaying((current) => !current)}
                                        className="rounded-full border border-white/20 bg-black/60 px-3 text-white hover:bg-black/80"
                                        aria-label={isSlideshowPlaying ? "Zatrzymaj slideshow" : "Uruchom slideshow"}
                                    >
                                        {isSlideshowPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                                        {isSlideshowPlaying ? "Pauza" : "Slideshow"}
                                    </Button>
                                ) : null}
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={() => openResultEditor(selectedResultUrl)}
                                    className="rounded-full border border-emerald-300/30 bg-emerald-600/70 text-white hover:bg-emerald-500"
                                    aria-label="Edytuj zdjęcie"
                                    title="Edytuj zdjęcie"
                                >
                                    <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={closeResultPreview}
                                    className="rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
                                    aria-label="Zamknij podgląd"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {resultCount > 1 ? (
                                <>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        onClick={showPrevResult}
                                        disabled={!hasPrevResult}
                                        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                                        aria-label="Poprzednie zdjęcie"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        onClick={showNextResult}
                                        disabled={!hasNextResult}
                                        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                                        aria-label="Następne zdjęcie"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                    <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white">
                                        {(selectedResultIndex ?? 0) + 1} / {resultCount}
                                    </div>
                                </>
                            ) : null}

                            <motion.img
                                src={selectedResultUrl}
                                alt="Powiększone zdjęcie"
                                className="max-h-[86vh] max-w-full rounded-xl object-contain shadow-2xl"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
