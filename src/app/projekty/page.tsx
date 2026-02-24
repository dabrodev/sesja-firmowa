"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession } from "@/lib/sessions";
import { Camera, Calendar, ArrowRight, Loader2, Coins } from "lucide-react";
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
            router.push("/login?callbackUrl=/projekty");
            return;
        }

        // Safety timeout: don't let the user hang forever if query fails or is slow
        const timer = setTimeout(() => {
            setLoading(false);
        }, 8000);

        if (user) {
            const fetchSessions = async () => {
                try {
                    const data = await sessionService.getUserSessions(user.uid);
                    setSessions(data);
                } catch (error) {
                    console.error("Error fetching sessions:", error);
                } finally {
                    clearTimeout(timer);
                    setLoading(false);
                }
            };
            fetchSessions();
        } else if (!authLoading) {
            setLoading(false);
            clearTimeout(timer);
        }

        return () => clearTimeout(timer);
    }, [user, authLoading, router]);

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
                <h1 className="mb-4 text-3xl font-bold">zaloguj się, aby zobaczyć swoje projekty</h1>
                <p className="mb-8 text-zinc-400">twoja historia sesji jest dostępna tylko dla zalogowanych użytkowników.</p>
                <Link href="/">
                    <Button className="bg-blue-600 hover:bg-blue-700">wróć do strony głównej</Button>
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
                                uruchom kreator
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-12">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">moje projekty</h1>
                    <p className="mt-2 text-zinc-400">historia twoich wygenerowanych sesji i wirtualnych biur.</p>
                </div>

                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                            <Camera className="h-8 w-8 text-zinc-500" />
                        </div>
                        <h2 className="text-xl font-semibold">nie masz jeszcze żadnych sesji</h2>
                        <p className="mt-2 mb-8 max-w-sm text-zinc-400">wgraj swoje zdjęcia i stwórz swoją pierwszą profesjonalną sesję biznesową AI.</p>
                        <Link href="/generator">
                            <Button className="bg-blue-600 hover:bg-blue-700">stwórz pierwszą sesję</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {sessions.map((session) => (
                            <Card key={session.id} className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl group hover:border-blue-500/30 transition-all">
                                <div className="aspect-video relative overflow-hidden">
                                    <img
                                        src={session.results[0] || "/photoshoot-1.png"}
                                        alt="Session thumbnail"
                                        className="h-full w-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                    <div className="absolute bottom-4 left-4">
                                        <div className="flex items-center gap-2 text-xs text-white/70">
                                            <Calendar className="h-3 w-3" />
                                            {session.createdAt?.toDate().toLocaleDateString('pl-PL')}
                                        </div>
                                    </div>
                                </div>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">sesja biznesowa</span>
                                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                                            {session.status === 'completed' ? 'ukończono' : 'szkic'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-6">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{session.faceReferences.length}</span>
                                            <span className="text-[10px] uppercase">Zdjęcia</span>
                                        </div>
                                        <div className="h-8 w-px bg-white/10" />
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{session.officeReferences.length}</span>
                                            <span className="text-[10px] uppercase">Biura</span>
                                        </div>
                                        <div className="h-8 w-px bg-white/10" />
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{session.results.length}</span>
                                            <span className="text-[10px] uppercase">Wyniki</span>
                                        </div>
                                    </div>
                                    <Button className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center justify-center gap-2">
                                        zobacz wyniki <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
