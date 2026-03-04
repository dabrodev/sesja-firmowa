"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";

const CREDIT_PACKS = [
    { name: "Starter", credits: 300 },
    { name: "Pro", credits: 900 },
    { name: "Business", credits: 2500 },
];

export default function CreditsPage() {
    const { user, userProfile, loading, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login?callbackUrl=/kredyty");
        }
    }, [loading, user, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
            <AppHeader user={user} userProfile={userProfile} loading={loading} onLogout={logout} sticky />

            <main className="container mx-auto max-w-5xl px-6 py-12 space-y-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Doładuj kredyty</h1>
                    <p className="mt-2 text-zinc-400">
                        Gdy zabraknie punktów, możesz doładować konto i kontynuować generowanie sesji.
                    </p>
                </div>

                <Card className="border-blue-500/20 bg-blue-500/10">
                    <CardContent className="flex items-center gap-3 p-5">
                        <Coins className="h-5 w-5 text-blue-300" />
                        <p className="text-sm text-zinc-200">
                            Aktualne saldo: <span className="font-semibold text-white">{userProfile?.credits ?? 0} PKT</span>
                        </p>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {CREDIT_PACKS.map((pack) => (
                        <Card key={pack.name} className="border-white/10 bg-white/5">
                            <CardContent className="p-5">
                                <div className="text-sm uppercase tracking-wide text-zinc-400">{pack.name}</div>
                                <div className="mt-2 text-3xl font-bold text-white">{pack.credits} PKT</div>
                                <Button
                                    className="mt-5 w-full bg-white/10 text-white hover:bg-white/20"
                                    disabled
                                >
                                    Wkrótce
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                    Do czasu uruchomienia płatności możesz korzystać z
                    {" "}
                    <Link href="/wolny-generator" className="font-medium text-white underline decoration-white/40 underline-offset-4">
                        wolnego generatora
                    </Link>
                    {" "}
                    (0 PKT).
                </div>
            </main>
        </div>
    );
}
