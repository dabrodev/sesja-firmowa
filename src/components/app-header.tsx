"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/lib/users";
import { cn } from "@/lib/utils";
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
import { Camera, Coins, Plus, Sparkles } from "lucide-react";

interface AppHeaderProps {
    user: User | null;
    userProfile?: UserProfile | null;
    loading?: boolean;
    onLogout?: () => Promise<void> | void;
    sticky?: boolean;
    fixed?: boolean;
}

const navItems = [
    { href: "/sesje", label: "Moje sesje" },
    { href: "/materialy", label: "Materiały" },
    { href: "/wolny-generator", label: "Pojedyncze zdjęcie", icon: Sparkles },
] as const;

const isRouteActive = (pathname: string, href: string): boolean => {
    if (href === "/sesje") {
        return pathname === href || pathname.startsWith("/sesje/");
    }
    return pathname === href;
};

export function AppHeader({ user, userProfile, loading = false, onLogout, sticky = false, fixed = false }: AppHeaderProps) {
    const pathname = usePathname();
    const router = useRouter();

    const secondaryButtonClass = (active: boolean) => cn(
        "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white",
        active ? "border-blue-500/40 bg-blue-500/20 text-white" : ""
    );

    const headerPositionClass = fixed
        ? "fixed top-0 z-50 w-full"
        : sticky
            ? "sticky top-0 z-50"
            : "";

    return (
        <header className={cn("border-b border-white/5 bg-black/20 backdrop-blur-xl", headerPositionClass)}>
            <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                        <Camera className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight sm:text-xl">SesjaFirmowa.pl</span>
                </Link>

                <div className="flex items-center gap-2 sm:gap-3">
                    {user && userProfile ? (
                        <div className="mr-1 hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium sm:flex">
                            <Coins className="h-4 w-4 text-blue-400" />
                            <span className="text-blue-400">{userProfile.credits}</span>
                            <span className="text-[10px] uppercase text-blue-400/60">PKT</span>
                        </div>
                    ) : null}

                    <nav className="hidden items-center gap-2 md:flex">
                        {navItems.map((item) => {
                            const active = isRouteActive(pathname, item.href);
                            const Icon = "icon" in item ? item.icon : undefined;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button variant="outline" size="sm" className={secondaryButtonClass(active)}>
                                        {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                                        {item.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </nav>

                    <Link href="/generator">
                        <Button
                            size="sm"
                            className={cn(
                                "h-9 whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 sm:px-4",
                                isRouteActive(pathname, "/generator") ? "ring-2 ring-blue-300/40" : ""
                            )}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nowa sesja
                        </Button>
                    </Link>

                    {loading ? (
                        <div className="h-9 w-9 animate-pulse rounded-full bg-white/5" />
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
                            <DropdownMenuContent className="w-64 border-white/10 bg-[#0f172a] text-white" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user.displayName || "Użytkownik"}</p>
                                        <p className="text-xs leading-none text-white/50">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem className="cursor-pointer focus:bg-white/5 focus:text-white" asChild>
                                    <Link href="/sesje">moje sesje</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer focus:bg-white/5 focus:text-white" asChild>
                                    <Link href="/generator">nowa sesja</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer focus:bg-white/5 focus:text-white" asChild>
                                    <Link href="/wolny-generator">generator pojedynczego zdjęcia</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer focus:bg-white/5 focus:text-white" asChild>
                                    <Link href="/materialy">moje materiały</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer focus:bg-white/5 focus:text-white" asChild>
                                    <Link href="/kredyty">doładuj kredyty</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem
                                    className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                                    onClick={() => {
                                        void onLogout?.();
                                    }}
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
                </div>
            </div>
        </header>
    );
}
