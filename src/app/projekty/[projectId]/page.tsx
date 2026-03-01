"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/components/auth-provider";
import { projectService, Project } from "@/lib/projects";
import { sessionService, Photosession } from "@/lib/sessions";
import { Camera, Calendar, ArrowRight, Loader2, ArrowLeft, Trash2, Pencil, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ProjectDetailsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [project, setProject] = useState<Project | null>(null);
    const [sessions, setSessions] = useState<Photosession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push(`/login?callbackUrl=/projekty/${projectId}`);
            return;
        }

        if (user && projectId) {
            const fetchData = async () => {
                try {
                    const [projData, sessData] = await Promise.all([
                        projectService.getProjectById(projectId),
                        sessionService.getSessionsByProjectId(projectId)
                    ]);

                    if (!projData || projData.userId !== user.uid) {
                        router.push("/projekty");
                        return;
                    }

                    setProject(projData);
                    setSessions(sessData);
                } catch (error) {
                    console.error("Error fetching project data:", error);
                    router.push("/projekty");
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [user, authLoading, router, projectId]);

    const handleDeleteProject = async () => {
        if (!project || !user) return;
        setIsDeleting(true);
        try {
            await projectService.deleteProject(project.id!);
            router.push("/projekty");
        } catch (error) {
            console.error("Error deleting project:", error);
            setIsDeleting(false);
        }
    };

    const handleUpdateName = async () => {
        if (!project || !editNameValue.trim() || editNameValue.trim() === project.name) {
            setIsEditingName(false);
            return;
        }
        setIsSavingName(true);
        try {
            await projectService.updateProject(project.id!, { name: editNameValue.trim() });
            setProject({ ...project, name: editNameValue.trim() });
            setIsEditingName(false);
        } catch (error) {
            console.error("Error updating project name:", error);
        } finally {
            setIsSavingName(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans pb-20">
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto flex h-16 items-center px-6 justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/projekty">
                            <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5 -ml-4">
                                <ArrowLeft className="mr-2 h-4 w-4" /> projekty
                            </Button>
                        </Link>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold tracking-tight">{project.name}</span>
                        </div>
                    </div>
                    <div className="text-xs text-zinc-500 hidden sm:flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        utworzono {project.createdAt?.toDate().toLocaleDateString('pl-PL')}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                    <div>
                        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 mt-2">
                                    <Input
                                        value={editNameValue}
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        className="text-2xl font-bold bg-black/20 border-white/20 text-white w-full max-w-sm h-12"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleUpdateName();
                                            if (e.key === 'Escape') setIsEditingName(false);
                                        }}
                                        disabled={isSavingName}
                                    />
                                    <Button size="icon" className="bg-emerald-600 hover:bg-emerald-700 h-12 w-12" onClick={handleUpdateName} disabled={isSavingName}>
                                        {isSavingName ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-12 w-12 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setIsEditingName(false)} disabled={isSavingName}>
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 group mt-2">
                                    <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-white"
                                        onClick={() => {
                                            setEditNameValue(project.name);
                                            setIsEditingName(true);
                                        }}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-zinc-400 mt-2">Sesje w ramach tego projektu</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <Link href="/generator">
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                Nowa sesja
                            </Button>
                        </Link>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Usuń projekt
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno chcesz usunąć projekt?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-zinc-400">
                                        Usunięcie projektu "{project.name}" zniknie go z Twojej listy projektów.
                                        Upewnij się, że przeniosłeś lub nie potrzebujesz już zawartych w nim sesji.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-transparent border-white/20 hover:bg-white/5 text-white">Anuluj</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={handleDeleteProject}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usuń"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                            <Camera className="h-8 w-8 text-zinc-500" />
                        </div>
                        <h2 className="text-xl font-semibold">Brak sesji w tym projekcie</h2>
                        <p className="mt-2 text-zinc-400">Rozpocznij tworzenie nowych zdjęć i wirtualnych biur, używając kreatora zawartego w tym projekcie.</p>
                        <div className="mt-8">
                            <Link href="/generator">
                                <Button className="bg-blue-600 hover:bg-blue-700">Uruchom kreator nowej sesji</Button>
                            </Link>
                        </div>
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
                                    <div className="absolute top-4 right-4">
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-8 w-8 bg-black/50 hover:bg-red-600/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                if (confirm("Czy na pewno chcesz usunąć tę sesję?")) {
                                                    try {
                                                        await sessionService.deleteSession(session.id!);
                                                        setSessions(sessions.filter(s => s.id !== session.id));
                                                    } catch (err) {
                                                        console.error("Failed to delete session", err);
                                                    }
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
                                    <Link href={`/projekty/${projectId}/sesja/${session.id}`} className="block">
                                        <Button className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center justify-center gap-2">
                                            zobacz wyniki <ArrowRight className="h-4 w-4" />
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
