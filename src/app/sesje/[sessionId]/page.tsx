"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession, PromptRunTrace } from "@/lib/sessions";
import { Camera, Calendar, ArrowLeft, Loader2, Download, ExternalLink, ImageIcon, PencilLine, Save, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PhotoUploader } from "@/components/photo-uploader";
import type { PhotoAsset } from "@/lib/store";
import { extractR2KeyFromReference, referenceUrlToPhotoAsset } from "@/lib/reference-assets";
import { ImageWithPlaceholder } from "@/components/image-with-placeholder";
import { downloadFile } from "@/lib/download";

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [session, setSession] = useState<Photosession | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditingReferences, setIsEditingReferences] = useState(false);
    const [isSavingReferences, setIsSavingReferences] = useState(false);
    const [faceReferencesDraft, setFaceReferencesDraft] = useState<PhotoAsset[]>([]);
    const [officeReferencesDraft, setOfficeReferencesDraft] = useState<PhotoAsset[]>([]);
    const [outfitReferencesDraft, setOutfitReferencesDraft] = useState<PhotoAsset[]>([]);
    const [customPromptDraft, setCustomPromptDraft] = useState("");
    const [requestedCountDraft, setRequestedCountDraft] = useState(4);
    const [isSyncingResults, setIsSyncingResults] = useState(false);
    const [currentRunGeneratedCount, setCurrentRunGeneratedCount] = useState(0);
    const [deletingResultIndex, setDeletingResultIndex] = useState<number | null>(null);
    const [isDeletingSession, setIsDeletingSession] = useState(false);

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
        const workflowInstanceId = session.activeWorkflowInstanceId || activeSessionId;
        const workflowRunId = session.activeWorkflowRunId || null;

        let cancelled = false;

        const syncSessionFromWorkflow = async () => {
            if (cancelled) return;
            setIsSyncingResults(true);
            try {
                const response = await fetch(
                    `/api/status?instanceId=${encodeURIComponent(workflowInstanceId)}&sessionId=${encodeURIComponent(activeSessionId)}${workflowRunId ? `&runId=${encodeURIComponent(workflowRunId)}` : ""}`,
                    { cache: "no-store" }
                );
                if (!response.ok) return;

                const data = await response.json() as {
                    status: "queued" | "running" | "complete" | "errored" | "terminated";
                    output?: { resultUrls?: string[]; promptDebug?: PromptRunTrace };
                };
                if (cancelled) return;

                const workflowResults = data.output?.resultUrls ?? [];
                setCurrentRunGeneratedCount(workflowResults.length);

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

                if (workflowResults.length > 0) {
                    const mergedResults = Array.from(new Set([...(session.results || []), ...workflowResults]));
                    const targetStatus = data.status === "complete" ? "completed" : "processing";
                    const hasNewResults = mergedResults.length !== session.results.length;
                    const statusChanged = session.status !== targetStatus;

                    if (hasNewResults || statusChanged) {
                        await sessionService.updateSession(activeSessionId, {
                            status: targetStatus,
                            results: mergedResults,
                            activeWorkflowInstanceId: targetStatus === "completed" ? null : workflowInstanceId,
                            activeWorkflowRunId: targetStatus === "completed" ? null : workflowRunId,
                        });

                        if (!cancelled) {
                            setSession((prev) => {
                                if (!prev) return prev;
                                return {
                                    ...prev,
                                    status: targetStatus,
                                    results: mergedResults,
                                    activeWorkflowInstanceId: targetStatus === "completed" ? null : workflowInstanceId,
                                    activeWorkflowRunId: targetStatus === "completed" ? null : workflowRunId,
                                };
                            });
                        }
                    }
                    if (data.status === "complete") {
                        setCurrentRunGeneratedCount(0);
                        return;
                    }
                }

                if (data.status === "errored" || data.status === "terminated") {
                    await sessionService.updateSession(activeSessionId, {
                        status: "failed",
                        activeWorkflowInstanceId: null,
                        activeWorkflowRunId: null,
                    });
                    if (!cancelled) {
                        setSession((prev) =>
                            prev
                                ? { ...prev, status: "failed", activeWorkflowInstanceId: null, activeWorkflowRunId: null }
                                : prev
                        );
                    }
                    setCurrentRunGeneratedCount(0);
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
    }, [session?.id, session?.status, session?.results, user]);

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
                    setSession(data);
                    resetReferenceDraft(data);
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

        if (officeReferencesDraft.length === 0) {
            alert("Wybierz jedną lokację biurową.");
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

        const confirmed = confirm("Usunąć to zdjęcie z sesji? Plik zostanie usunięty również z Cloudflare R2.");
        if (!confirmed) return;

        const targetUrl = session.results[index];
        setDeletingResultIndex(index);
        try {
            await deleteR2ByReference(targetUrl);
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
            alert("Nie można usunąć sesji w trakcie aktywnego generowania.");
            return;
        }

        const confirmed = confirm("Usunąć całą sesję? Wszystkie wygenerowane zdjęcia zostaną usunięte także z Cloudflare R2.");
        if (!confirmed) return;

        setIsDeletingSession(true);
        try {
            for (const url of session.results) {
                try {
                    await deleteR2ByReference(url);
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

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!session || !user) return null;

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
    const missingCurrentRunCount = isProcessing
        ? Math.max(expectedCurrentRunCount - currentRunGeneratedCount, 0)
        : 0;
    const currentRunProgressPercent = expectedCurrentRunCount
        ? Math.min(100, Math.round((currentRunGeneratedCount / expectedCurrentRunCount) * 100))
        : 0;

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans pb-20">
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <div className="flex items-center">
                        <Link href={`/sesje`}>
                            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-4 mr-4">
                                <ArrowLeft className="mr-2 h-4 w-4" /> wszystkie sesje
                            </Button>
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Camera className="h-4 w-4 text-blue-400" />
                            </div>
                            <span className="text-lg font-bold tracking-tight">Szczegóły Sesji</span>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
                                    <AvatarFallback className="bg-blue-600 text-white">
                                        {user?.displayName?.charAt(0) || user?.email?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-[#0f172a] border-white/10 text-white" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                                    <p className="text-xs leading-none text-white/50">{user?.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer" asChild>
                                <Link href="/sesje">moje sesje</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer" asChild>
                                <Link href="/materialy">moje materiały</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem
                                className="focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-red-400"
                                onClick={() => logout()}
                            >
                                wyloguj się
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
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
                            <Link href={`/generator?sessionId=${session.id}`}>
                                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20">
                                    Kontynuuj sesję (+{session.requestedCount} zdjęć)
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                                onClick={() => void handleDeleteSession()}
                                disabled={isDeletingSession || session.status === "processing"}
                            >
                                {isDeletingSession ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Usuń sesję
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Results Column (Takes up 2/3 on desktop) */}
                    <div className="lg:col-span-2 space-y-6">
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
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                                            style={{ width: `${currentRunProgressPercent}%` }}
                                        />
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {session.results.map((url, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-[3/4]"
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
                                                    onClick={() => handleDownload(url, i)}
                                                >
                                                    <Download className="mr-2 h-4 w-4" /> Pobierz HD
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md"
                                                    onClick={() => window.open(url, "_blank")}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="bg-red-600/80 hover:bg-red-500 text-white backdrop-blur-md"
                                                    onClick={() => void handleDeleteResult(i)}
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
                                    ? Array.from({ length: missingCurrentRunCount }).map((_, idx) => (
                                        <div
                                            key={`placeholder-${idx}`}
                                            className="relative rounded-2xl overflow-hidden border border-dashed border-blue-500/30 bg-blue-500/5 aspect-[3/4] flex items-center justify-center"
                                        >
                                            <div className="text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto mb-2" />
                                                <p className="text-xs text-blue-100">
                                                    Generowanie
                                                    {" "}
                                                    {Math.min(currentRunGeneratedCount + idx + 1, expectedCurrentRunCount)}
                                                    /
                                                    {expectedCurrentRunCount}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                    : null}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Reference Column */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">Użyte materiały</h2>
                            {!isEditingReferences ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                    onClick={() => {
                                        resetReferenceDraft(session);
                                        setIsEditingReferences(true);
                                    }}
                                >
                                    <PencilLine className="mr-2 h-4 w-4" /> Wymień materiały
                                </Button>
                            ) : null}
                        </div>
                        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                            <CardContent className="p-6 space-y-8">
                                {isEditingReferences ? (
                                    <>
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
                                            Możesz podmienić materiały i kontynuować tę samą sesję. Lokacja biurowa jest ograniczona do 1 zdjęcia, żeby uniknąć miksowania pomieszczeń.
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
                                        />

                                        <div className="h-px bg-white/10 w-full" />

                                        <PhotoUploader
                                            title="Lokacja Biurowa"
                                            description="Wybierz jedną lokację biurową dla kolejnych ujęć tej sesji."
                                            assets={officeReferencesDraft}
                                            onUpload={(asset) => setOfficeReferencesDraft([asset])}
                                            onRemove={(id) => setOfficeReferencesDraft((prev) => prev.filter((asset) => asset.id !== id))}
                                            maxFiles={1}
                                            userId={user.uid}
                                            assetType="office"
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
                                                        {["1", "2", "3", "4", "5"].map((value) => (
                                                            <SelectItem key={value} value={value}>
                                                                {value} zdjęć
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

                                        <Link href={`/generator?sessionId=${session.id}`}>
                                            <Button
                                                variant="outline"
                                                className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                            >
                                                Kontynuuj tę sesję (+{session.requestedCount} zdjęć)
                                            </Button>
                                        </Link>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
