"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession } from "@/lib/sessions";
import { Camera, Calendar, ArrowRight, Loader2, Coins, Plus, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SessionsPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [sessions, setSessions] = useState<Photosession[]>([]);
    const [loading, setLoading] = useState(true);

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
    }, [user, authLoading, router]);

    const fetchData = async () => {
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
    };

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
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                            <Camera className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">SesjaFirmowa.pl</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {user && userProfile && (
                            <div className="mr-2 hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium sm:flex">
                                <Coins className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-400">{userProfile.credits}</span>
                                <span className="text-[10px] uppercase text-blue-400/60">PKT</span>
                            </div>
                        )}
                        <Link href="/generator">
                            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                                Uruchom Kreator
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-12">
                <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">Moje Sesje</h1>
                        <p className="mt-2 text-zinc-400">Przeglądaj wygenerowane materiały i domawiaj kolejne z ujęć.</p>
                    </div>

                    <Link href="/generator">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" /> Nowa Sesja
                        </Button>
                    </Link>
                </div>

                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                            <Camera className="h-8 w-8 text-zinc-500" />
                        </div>
                        <h2 className="text-xl font-semibold">Nie wygenerowałeś jeszcze żadnej sesji</h2>
                        <p className="mt-2 mb-8 max-w-sm text-zinc-400">Przejdź do kreatora, ustaw parametry wizerunku oraz biura i odbierz pakiet gotowych zdjęć.</p>
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
                                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1">
                                                <ImageIcon className="w-3 h-3" /> {session.results?.length || 0} zdjęć
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <CardContent className="p-4 bg-zinc-900/50 border-t border-white/5">
                                    <Link href={`/sesje/${session.id}`} className="block">
                                        <Button className="w-full bg-white/5 hover:bg-blue-600 hover:border-blue-500 text-white border border-white/10 flex items-center justify-center gap-2 transition-all">
                                            Zobacz Sesję <ArrowRight className="h-4 w-4" />
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
