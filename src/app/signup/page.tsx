"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SignUpContent() {
    const { loginWithGoogle, signUpWithEmail } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/generator";

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            await loginWithGoogle();
            router.push(callbackUrl);
        } catch (err) {
            setError("Rejestracja przez Google nie powiodła się.");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError("Hasło musi mieć co najmniej 6 znaków.");
            return;
        }
        try {
            setLoading(true);
            setError("");
            await signUpWithEmail(email, password);
            router.push(callbackUrl);
        } catch (err: any) {
            if (err.code === "auth/email-already-in-use") {
                setError("Ten e-mail jest już w użyciu.");
            } else {
                setError("Wystąpił błąd podczas rejestracji.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6">
            <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                            <Camera className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-white">SesjaFirmowa.pl</span>
                    </Link>
                    <h2 className="mt-6 text-3xl font-bold text-white">Utwórz konto</h2>
                    <p className="mt-2 text-zinc-400">Zacznij tworzyć profesjonalne sesje biznesowe AI.</p>
                </div>

                <div className="space-y-4 pt-4">
                    <Button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white text-black hover:bg-zinc-200 h-12 text-base font-semibold transition-all flex items-center justify-center gap-3"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
                        )}
                        Zarejestruj przez Google
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#020617] px-2 text-zinc-500">lub e-mail</span>
                        </div>
                    </div>

                    <form onSubmit={handleEmailSignUp} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">E-mail</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none transition-all"
                                placeholder="twoj@email.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Hasło</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none transition-all"
                                placeholder="•••••••• (min. 6 znaków)"
                            />
                        </div>

                        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-semibold shadow-lg shadow-blue-500/20"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Załóż konto"}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-sm text-zinc-400">
                    Masz już konto?{" "}
                    <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Zaloguj się
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function SignUpPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#020617]"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>}>
            <SignUpContent />
        </Suspense>
    );
}
