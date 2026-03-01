"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { SessionWizard } from "@/components/session-wizard";
import { BetaGuard } from "@/components/beta-guard";
import { Camera, Sparkles, UserCheck, Zap, ArrowRight, Home, Coins } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    const projectId = searchParams.get("projectId") || undefined;
    return <SessionWizard projectId={projectId} />;
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
            {/* Navigation (Matching Landing Page) */}
            <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/20 backdrop-blur-xl">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-all">
                            <Camera className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">SesjaFirmowa.pl</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {user && userProfile && (
                            <div className="mr-2 hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium sm:flex">
                                <Coins className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-400">{userProfile.credits}</span>
                                <span className="text-[10px] uppercase text-blue-400/60">PKT</span>
                            </div>
                        )}
                        {loading ? (
                            <div className="h-9 w-24 animate-pulse rounded-lg bg-white/5" />
                        ) : user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                                            <AvatarFallback className="bg-blue-600 text-white">
                                                {user.displayName?.charAt(0) || user.email?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 bg-[#0f172a] border-white/10 text-white" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.displayName}</p>
                                            <p className="text-xs leading-none text-white/50">{user.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer" asChild>
                                        <Link href="/projekty">moje projekty</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer">
                                        ustawienia
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
                        ) : (
                            <Button
                                variant="ghost"
                                className="text-white/70 hover:bg-white/5 hover:text-white"
                                onClick={() => router.push("/login")}
                            >
                                Zaloguj
                            </Button>
                        )}
                        <Link href="/">
                            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hidden sm:flex">
                                <Home className="mr-2 h-4 w-4" /> powrót
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

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
