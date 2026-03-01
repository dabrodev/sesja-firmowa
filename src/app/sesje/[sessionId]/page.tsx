"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/components/auth-provider";
import { sessionService, Photosession } from "@/lib/sessions";
import { Camera, Calendar, ArrowLeft, Loader2, Download, ExternalLink, ImageIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [session, setSession] = useState<Photosession | null>(null);
    const [loading, setLoading] = useState(true);

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
                } catch (error) {
                    console.error("Error fetching session:", error);
                    router.push(`/sesje`);
                } finally {
                    setLoading(false);
                }
            };
            fetchSession();
        }
    }, [user, authLoading, router, sessionId]);

    const handleDownload = async (url: string, index: number) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `sesja-${session?.id}-photo-${index + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Error downloading image:", error);
            // Fallback opening in new tab
            window.open(url, "_blank");
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans pb-20">
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto flex h-16 items-center px-6">
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
                        <Link href={`/generator?sessionId=${session.id}`}>
                            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20">
                                Dogeneruj +4 zdjęcia
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Results Column (Takes up 2/3 on desktop) */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <ImageIcon className="h-5 w-5 text-blue-400" />
                            Wygenerowane Fotografie
                        </h2>

                        {session.results.length === 0 ? (
                            <Card className="border-white/10 bg-white/5 backdrop-blur-xl border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                                    <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                                    <h3 className="text-lg font-medium text-white">Sesja w trakcie generowania</h3>
                                    <p className="text-zinc-400 max-w-sm mt-2">To może potrwać kilka minut. Odśwież stronę za moment, aby sprawdzić wyniki.</p>
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
                                        <img
                                            src={url}
                                            alt={`Generated shot ${i + 1}`}
                                            className="w-full h-full object-cover"
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
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Reference Column */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold">Użyte materiały</h2>
                        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                            <CardContent className="p-6 space-y-8">

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-medium text-zinc-300">Zdjęcia Wizerunkowe</span>
                                        <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{session.faceReferences.length}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {session.faceReferences.map((url, i) => (
                                            <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                                                <img src={url} className="w-full h-full object-cover" alt="Face ref" />
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
                                                <img src={url} className="w-full h-full object-cover" alt="Office ref" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
