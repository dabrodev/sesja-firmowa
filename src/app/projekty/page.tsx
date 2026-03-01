"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { projectService, Project } from "@/lib/projects";
import { sessionService, Photosession } from "@/lib/sessions";
import { FolderGit2, Calendar, ArrowRight, Loader2, Coins, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface ProjectWithStats extends Project {
    sessionCount: number;
    thumbnailUrl?: string;
}

export default function ProjectsPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<ProjectWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login?callbackUrl=/projekty");
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
            const [fetchedProjects, fetchedSessions] = await Promise.all([
                projectService.getUserProjects(user.uid),
                sessionService.getUserSessions(user.uid)
            ]);

            // Auto-migration: Check for orphan sessions
            const orphanSessions = fetchedSessions.filter(s => !s.projectId);
            if (orphanSessions.length > 0) {
                console.log(`Found ${orphanSessions.length} orphaned sessions. Migrating to default project...`);
                // Create a default project
                const defaultProjectId = await projectService.createProject(user.uid, "Domyślny projekt");

                // Update all orphan sessions
                await Promise.all(
                    orphanSessions.map(session =>
                        sessionService.updateSession(session.id!, { projectId: defaultProjectId })
                    )
                );

                // Refetch recursively once
                return fetchData();
            }

            const enriched = fetchedProjects.map(p => {
                const projectSessions = fetchedSessions.filter(s => s.projectId === p.id);
                const latestSession = projectSessions[0]; // Sort order is descending usually
                return {
                    ...p,
                    sessionCount: projectSessions.length,
                    thumbnailUrl: latestSession?.results?.[0] || undefined
                };
            });
            setProjects(enriched);
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newProjectName.trim()) return;

        setIsCreating(true);
        try {
            const projectId = await projectService.createProject(user.uid, newProjectName.trim());
            setNewProjectName("");
            setIsDialogOpen(false);
            // Navigate directly to the new project or refetch
            router.push(`/projekty/${projectId}`);
        } catch (error) {
            console.error("Error creating project:", error);
            setIsCreating(false);
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
                            <FolderGit2 className="h-5 w-5 text-white" />
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
                <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">moje projekty</h1>
                        <p className="mt-2 text-zinc-400">zarządzaj swoimi projektami i historią sesji.</p>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="mr-2 h-4 w-4" /> nowy projekt
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] bg-[#0f172a] border-white/10 text-white">
                            <form onSubmit={handleCreateProject}>
                                <DialogHeader>
                                    <DialogTitle>Utwórz nowy projekt</DialogTitle>
                                    <DialogDescription className="text-zinc-400">
                                        Projekty pozwalają Ci na grupowanie związanych ze sobą sesji i wygenerowanych zdjęć.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-6">
                                    <div className="flex flex-col gap-3">
                                        <label htmlFor="name" className="text-sm font-medium">
                                            Nazwa projektu
                                        </label>
                                        <Input
                                            id="name"
                                            value={newProjectName}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProjectName(e.target.value)}
                                            placeholder="np. Kampania Jesienna 2026"
                                            className="bg-black/20 border-white/10 text-white placeholder:text-zinc-500"
                                            required
                                            disabled={isCreating}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" className="hover:bg-white/5 hover:text-white" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                                        Anuluj
                                    </Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isCreating || !newProjectName.trim()}>
                                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Utwórz
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                            <FolderGit2 className="h-8 w-8 text-zinc-500" />
                        </div>
                        <h2 className="text-xl font-semibold">nie masz jeszcze żadnych projektów</h2>
                        <p className="mt-2 mb-8 max-w-sm text-zinc-400">utwórz swój pierwszy projekt, aby zacząć generować zdjęcia wizerunkowe i biura.</p>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> utwórz pierwszy projekt
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {projects.map((project) => (
                            <Card key={project.id} className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl group hover:border-blue-500/30 transition-all">
                                <div className="aspect-video relative overflow-hidden bg-black/40 flex items-center justify-center">
                                    {project.thumbnailUrl ? (
                                        <img
                                            src={project.thumbnailUrl}
                                            alt={`${project.name} thumbnail`}
                                            className="h-full w-full object-cover grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                                        />
                                    ) : (
                                        <FolderGit2 className="h-12 w-12 text-zinc-700 group-hover:text-blue-500/50 transition-colors duration-500" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-black/40 to-transparent opacity-80" />
                                    <div className="absolute bottom-4 left-4 right-4 text-left">
                                        <h3 className="text-lg font-bold text-white mb-1 drop-shadow-md truncate">{project.name}</h3>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-zinc-300">
                                                <Calendar className="h-3 w-3" />
                                                {project.createdAt?.toDate().toLocaleDateString('pl-PL')}
                                            </div>
                                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                                {project.sessionCount} sesji
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <CardContent className="p-4 bg-zinc-900/50 border-t border-white/5">
                                    <Link href={`/projekty/${project.id}`} className="block">
                                        <Button className="w-full bg-white/5 hover:bg-blue-600 hover:border-blue-500 text-white border border-white/10 flex items-center justify-center gap-2 transition-all">
                                            otwórz projekt <ArrowRight className="h-4 w-4" />
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
