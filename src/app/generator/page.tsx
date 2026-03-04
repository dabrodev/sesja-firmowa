"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SessionWizard } from "@/components/session-wizard";
import { BetaGuard } from "@/components/beta-guard";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { sessionService } from "@/lib/sessions";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
};

const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.1
        }
    }
};

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function WizardWrapper() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("sessionId") || undefined;
    const router = useRouter();
    const { user } = useAuth();
    const [sessionName, setSessionName] = useState<{ sessionId: string; name: string | null } | null>(null);

    useEffect(() => {
        let active = true;

        if (!sessionId || !user) {
            return () => {
                active = false;
            };
        }

        void sessionService.getSessionById(sessionId).then((session) => {
            if (!active) return;
            if (!session || session.userId !== user.uid) {
                setSessionName({ sessionId, name: null });
                return;
            }
            setSessionName({ sessionId, name: session.name || null });
        });

        return () => {
            active = false;
        };
    }, [sessionId, user]);

    const resolvedSessionName =
        sessionId && sessionName?.sessionId === sessionId ? sessionName.name : null;

    return (
        <div className="space-y-6">
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                {sessionId ? (
                    <div className="space-y-1.5">
                        <p>
                            Tryb: <span className="font-semibold text-white">Kontynuacja sesji</span>. Kontynuujesz:
                            {" "}
                            <span className="font-semibold text-white">
                                {resolvedSessionName ?? `ID ${sessionId.slice(0, 8)}...`}
                            </span>.
                        </p>
                        <p className="text-zinc-400">
                            Liczbę nowych zdjęć (1-5) ustawisz w ostatnim kroku.
                        </p>
                    </div>
                ) : (
                    <p>
                        Tryb: <span className="font-semibold text-white">Nowa sesja</span>. Zostanie utworzona nowa sesja po kliknięciu generowania.
                    </p>
                )}
            </div>
            <SessionWizard sessionId={sessionId} onNewSessionRequested={() => router.replace("/generator")} />
        </div>
    );
}

export default function App() {
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login?callbackUrl=/generator");
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
            <AppHeader user={user} userProfile={userProfile} loading={loading} onLogout={logout} sticky />

            <main>
                <BetaGuard>
                    <section className="relative flex flex-col items-center justify-center overflow-hidden px-4 pt-32 pb-20">
                        <div className="absolute top-1/4 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[120px]" />

                        <motion.div
                            className="text-center"
                            initial="initial"
                            animate="animate"
                            variants={staggerContainer}
                        >
                            <motion.div
                                variants={fadeInUp}
                                className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400"
                            >
                                <Sparkles className="h-4 w-4" />
                                <span>Studio Kreatywne AI</span>
                            </motion.div>

                            <motion.h1
                                variants={fadeInUp}
                                className="mb-10 max-w-4xl bg-gradient-to-b from-white to-white/50 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl"
                            >
                                Kreator twojej <span className="text-blue-500">sesji</span>
                            </motion.h1>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                            className="w-full max-w-5xl mx-auto"
                        >
                            <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
                                <WizardWrapper />
                            </Suspense>
                        </motion.div>
                    </section>
                </BetaGuard>
            </main>
        </div>
    );
}
