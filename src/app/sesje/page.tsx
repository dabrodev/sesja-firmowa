"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession } from "@/lib/sessions";
import { Camera, Calendar, ArrowRight, Loader2, Plus, Sparkles, Image as ImageIcon, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";

export default function SessionsPage() {
    const { user, userProfile, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [sessions, setSessions] = useState<Photosession[]>([]);
    const [loading, setLoading] = useState(true);
    const [runProgress, setRunProgress] = useState<Record<string, number>>({});

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const fetchedSessions = await sessionService.getUserSessions(user.uid);
            setSessions(fetchedSessions);
        } catch (error) {
            console.error("Error fetching sessions:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login?callbackUrl=/sesje");
            return;
        }

        const timer = setTimeout(() => {
            setLoading(false);
        }, 8000);

        if (user) {
            fetchData();
        } else if (!authLoading) {
            setLoading(false);
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [user, authLoading, router, fetchData]);

    useEffect(() => {
        if (!user || sessions.length === 0) return;
        const processingSessions = sessions.filter((session) => session.status === "processing" && session.id);
        if (processingSessions.length === 0) return;

        let cancelled = false;

        const syncSession = async (processingSession: Photosession) => {
            if (!processingSession.id) return;
            const workflowInstanceId = processingSession.activeWorkflowInstanceId || processingSession.id;
            const workflowRunId = processingSession.activeWorkflowRunId || null;

            try {
                const response = await fetch(
                    `/api/status?instanceId=${encodeURIComponent(workflowInstanceId)}&sessionId=${encodeURIComponent(processingSession.id)}${workflowRunId ? `&runId=${encodeURIComponent(workflowRunId)}` : ""}`,
                    { cache: "no-store" }
                );
                if (!response.ok || cancelled) return;

                const data = await response.json() as {
                    status: "queued" | "running" | "complete" | "errored" | "terminated";
                    output?: { resultUrls?: string[] };
                };
                if (cancelled) return;

                const workflowResults = data.output?.resultUrls ?? [];
                setRunProgress((prev) => {
                    const current = prev[processingSession.id!] ?? 0;
                    if (current === workflowResults.length) return prev;
                    return { ...prev, [processingSession.id!]: workflowResults.length };
                });

                const mergedResults = workflowResults.length > 0
                    ? Array.from(new Set([...(processingSession.results || []), ...workflowResults]))
                    : (processingSession.results || []);
                const hasNewResults = mergedResults.length !== (processingSession.results?.length || 0);

                if (data.status === "complete") {
                    await sessionService.updateSession(processingSession.id, {
                        status: "completed",
                        results: mergedResults,
                        activeWorkflowInstanceId: null,
                        activeWorkflowRunId: null,
                    });
                    if (!cancelled) {
                        setSessions((prev) =>
                            prev.map((session) =>
                                session.id === processingSession.id
                                    ? {
                                        ...session,
                                        status: "completed",
                                        results: mergedResults,
                                        activeWorkflowInstanceId: null,
                                        activeWorkflowRunId: null,
                                    }
                                    : session
                            )
                        );
                    }
                    return;
                }

                if (data.status === "errored" || data.status === "terminated") {
                    await sessionService.updateSession(processingSession.id, {
                        status: "failed",
                        activeWorkflowInstanceId: null,
                        activeWorkflowRunId: null,
                    });
                    if (!cancelled) {
                        setSessions((prev) =>
                            prev.map((session) =>
                                session.id === processingSession.id
                                    ? { ...session, status: "failed", activeWorkflowInstanceId: null, activeWorkflowRunId: null }
                                    : session
                            )
                        );
                    }
                    return;
                }

                if (hasNewResults) {
                    await sessionService.updateSession(processingSession.id, {
                        status: "processing",
                        results: mergedResults,
                    });
                    if (!cancelled) {
                        setSessions((prev) =>
                            prev.map((session) =>
                                session.id === processingSession.id
                                    ? { ...session, status: "processing", results: mergedResults }
                                    : session
                            )
                        );
                    }
                }
            } catch (error) {
                console.warn("Failed to sync processing session:", error);
            }
        };

        const syncAll = async () => {
            await Promise.all(processingSessions.map(syncSession));
        };

        void syncAll();
        const interval = setInterval(() => {
            void syncAll();
        }, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [user, sessions]);

    const activeGeneratingSessions = sessions.filter((session) => session.status === "processing" && session.id);

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] p-4 text-center">
                <h1 className="mb-4 text-3xl font-bold">Zaloguj się, aby zobaczyć swoje sesje</h1>
                <p className="mb-8 text-zinc-400">Twoja historia sesji fotograficznych jest dostępna tylko dla zalogowanych użytkowników.</p>
                <Link href="/">
                    <Button className="bg-blue-600 hover:bg-blue-700">Wróć do strony głównej</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
            <AppHeader user={user} userProfile={userProfile} onLogout={logout} sticky />

            <main className="container mx-auto px-6 py-12">
                <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">Moje Sesje</h1>
                        <p className="mt-2 text-zinc-400">Przeglądaj wygenerowane materiały i domawiaj kolejne z ujęć.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link href="/materialy">
                            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                Moje materiały
                            </Button>
                        </Link>
                        <Link href="/wolny-generator">
                            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                <Sparkles className="mr-2 h-4 w-4" /> Pojedyncze zdjęcie
                            </Button>
                        </Link>
                        <Link href="/generator">
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" /> Nowa Sesja
                            </Button>
                        </Link>
                    </div>
                </div>

                {activeGeneratingSessions.length > 0 ? (
                    <Card className="mb-8 border-blue-500/20 bg-blue-500/10">
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-center gap-2 text-blue-100">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <h2 className="font-semibold">Aktywne generowanie sesji</h2>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {activeGeneratingSessions.map((session) => {
                                    const generatedCount = session.id ? (runProgress[session.id] ?? 0) : 0;
                                    const expectedCount = Math.max(1, session.requestedCount);
                                    const progressPercent = Math.min(100, Math.round((generatedCount / expectedCount) * 100));

                                    return (
                                        <div key={`active-${session.id}`} className="rounded-xl border border-blue-400/20 bg-black/20 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-white">{session.name}</p>
                                                    <p className="text-xs text-zinc-300 mt-1">
                                                        Wygenerowano {generatedCount}/{expectedCount} zdjęć
                                                    </p>
                                                </div>
                                                <Link href={`/sesje/${session.id}`}>
                                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
                                                        Wróć do sesji
                                                    </Button>
                                                </Link>
                                            </div>
                                            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                            <Camera className="h-8 w-8 text-zinc-500" />
                        </div>
                        <h2 className="text-xl font-semibold">Nie wygenerowałeś jeszcze żadnej sesji</h2>
                        <p className="mt-2 mb-8 max-w-sm text-zinc-400">Rozpocznij nową sesję, ustaw parametry wizerunku oraz biura i odbierz pakiet gotowych zdjęć.</p>
                        <Link href="/generator">
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" /> Rozpocznij pierwszą Sesję
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {sessions.map((session) => (
                            <Card key={session.id} className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl group hover:border-blue-500/30 transition-all">
                                <div className="aspect-video relative overflow-hidden bg-black/40 flex items-center justify-center">
                                    {session.results?.[0] ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={session.results[0]}
                                            alt={session.name}
                                            className="h-full w-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                                        />
                                    ) : (
                                        <Camera className="h-12 w-12 text-zinc-700 group-hover:text-blue-500/50 transition-colors duration-500" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-black/40 to-transparent opacity-80" />
                                    <div className="absolute bottom-4 left-4 right-4 text-left">
                                        <h3 className="text-lg font-bold text-white mb-1 drop-shadow-md truncate">{session.name}</h3>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-zinc-300">
                                                <Calendar className="h-3 w-3" />
                                                {session.createdAt?.toDate().toLocaleDateString('pl-PL')}
                                            </div>
                                            {session.status === "processing" ? (
                                                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                                                    <Clock3 className="w-3 h-3" /> trwa generowanie
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1">
                                                    <ImageIcon className="w-3 h-3" /> {session.results?.length || 0} zdjęć
                                                </span>
                                            )}
                                        </div>
                                        {session.status === "processing" ? (
                                            <p className="mt-2 text-xs text-amber-100/90">
                                                Postęp: {session.id ? (runProgress[session.id] ?? 0) : 0}/{Math.max(1, session.requestedCount)} zdjęć
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                <CardContent className="p-4 bg-zinc-900/50 border-t border-white/5">
                                    <Link href={`/sesje/${session.id}`} className="block">
                                        <Button className="w-full bg-white/5 hover:bg-blue-600 hover:border-blue-500 text-white border border-white/10 flex items-center justify-center gap-2 transition-all">
                                            Otwórz sesję <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
