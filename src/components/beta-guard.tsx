"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const BetaGuard = ({ children }: { children: React.ReactNode }) => {
    const { userProfile, activateBeta } = useAuth();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const result = await activateBeta(code);
            if (result) {
                setSuccess(true);
            } else {
                setError("Nieprawidłowy kod dostępu. Spróbuj ponownie.");
            }
        } catch (err) {
            setError("Wystąpił błąd. Spróbuj później.");
        } finally {
            setLoading(false);
        }
    };

    if (userProfile?.isBetaTester) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6 py-20 relative overflow-hidden">
            {/* Animated background glow elements */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
                {[...Array(3)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.2, 0.1],
                        }}
                        transition={{
                            duration: 8 + i * 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        className="absolute h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[100px]"
                        style={{
                            left: `${i * 30 - 10}%`,
                            top: `${i * 20 - 10}%`,
                        }}
                    />
                ))}
            </div>

            <div className="relative w-full max-w-md">
                {/* Highlight Glow */}
                <motion.div
                    animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.3, 0.2] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 blur-2xl"
                />

                <div className="relative space-y-8 rounded-[2rem] border border-white/10 bg-[#020617]/90 p-8 backdrop-blur-2xl shadow-2xl">
                    <div className="text-center">
                        <motion.div
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20 shadow-inner"
                        >
                            <Lock className="h-10 w-10 text-blue-500" />
                        </motion.div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Dostęp Beta</h2>
                        <p className="mt-3 text-zinc-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                            Wprowadź swój unikalny kod, aby odblokować kreator i otrzymać pakiet 900 kredytów.
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {success ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="flex flex-col items-center justify-center space-y-4 py-6 text-center"
                            >
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xl font-bold text-emerald-400">Dostęp przyznany!</p>
                                    <p className="text-sm text-zinc-500 italic">Przekierowujemy do studia...</p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.form
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onSubmit={handleSubmit}
                                className="space-y-6"
                            >
                                <div className="space-y-3">
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            placeholder="WPISZ KOD"
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-2xl font-black tracking-[0.4em] text-white placeholder-zinc-800 focus:border-blue-500/50 focus:bg-white/[0.08] focus:outline-none transition-all shadow-inner"
                                            required
                                        />
                                        <div className="absolute inset-0 -z-10 rounded-2xl bg-blue-500/5 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-xl bg-red-500/10 py-3 border border-red-500/20"
                                    >
                                        <p className="text-center text-xs font-semibold text-red-400">
                                            {error}
                                        </p>
                                    </motion.div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={loading || !code}
                                    className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 h-16 text-lg font-bold shadow-2xl shadow-blue-500/40 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative border border-white/10"
                                >
                                    {loading ? (
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    ) : (
                                        <span className="flex items-center justify-center gap-2 relative z-10 text-white">
                                            odblokuj kreator <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                                        </span>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                </Button>

                                <p className="text-center text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-600">
                                    wymagany kod dostępu
                                </p>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
