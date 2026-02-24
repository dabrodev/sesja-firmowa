"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Camera, Github, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { loginWithGoogle, signInWithEmail } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            await loginWithGoogle();
            router.push("/generator");
        } catch (err) {
            setError("Logowanie przez Google nie powiodło się.");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError("");
            await signInWithEmail(email, password);
            router.push("/generator");
        } catch (err: any) {
            setError("Nieprawidłowy e-mail lub hasło.");
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
                    <h2 className="mt-6 text-3xl font-bold text-white">Witaj ponownie</h2>
                    <p className="mt-2 text-zinc-400">Zaloguj się, aby kontynuować tworzenie sesji.</p>
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
                        Zaloguj przez Google
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#020617] px-2 text-zinc-500">lub przez e-mail</span>
                        </div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-4">
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
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-zinc-400">Hasło</label>
                                <Link href="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Zapomniałeś hasła?</Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base font-semibold shadow-lg shadow-blue-500/20"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Zaloguj się"}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-sm text-zinc-400">
                    Nie masz konta?{" "}
                    <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Zarejestruj się
                    </Link>
                </p>
            </div>
        </div>
    );
}
