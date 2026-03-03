"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { assetService, UserAsset } from "@/lib/assets";
import { AssetType, useAppStore } from "@/lib/store";
import { Camera, Coins, Loader2, Sparkles, Trash2, Images, CheckSquare, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageWithPlaceholder } from "@/components/image-with-placeholder";
import { sessionService } from "@/lib/sessions";

type AssetFilter = "all" | AssetType;

const FILTER_LABELS: Record<AssetFilter, string> = {
    all: "Wszystkie",
    face: "Wizerunek",
    office: "Biuro",
    outfit: "Ubiór",
};

const TYPE_LABELS: Record<AssetType, string> = {
    face: "Wizerunek",
    office: "Biuro",
    outfit: "Ubiór",
};

export default function MaterialsPage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const { removeFaceReference, removeOfficeReference, removeOutfitReference } = useAppStore();
    const router = useRouter();
    const [assets, setAssets] = useState<UserAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeFilter, setActiveFilter] = useState<AssetFilter>("all");
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

    const fetchAssets = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const fetchedAssets = await assetService.getAllUserAssets(user.uid);
            setAssets(fetchedAssets);
        } catch (error) {
            console.error("Error fetching user assets:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login?callbackUrl=/materialy");
            return;
        }

        if (user) {
            void fetchAssets();
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [authLoading, fetchAssets, router, user]);

    const filteredAssets = useMemo(() => {
        if (activeFilter === "all") return assets;
        return assets.filter((asset) => asset.type === activeFilter);
    }, [activeFilter, assets]);

    const selectedCount = useMemo(() => {
        let count = 0;
        for (const asset of filteredAssets) {
            if (selectedDocIds.has(asset.docId)) count++;
        }
        return count;
    }, [filteredAssets, selectedDocIds]);

    const toggleSelection = (docId: string) => {
        setSelectedDocIds((prev) => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId);
            else next.add(docId);
            return next;
        });
    };

    const selectAllFiltered = () => {
        setSelectedDocIds((prev) => {
            const next = new Set(prev);
            const allSelected = filteredAssets.every((asset) => next.has(asset.docId));
            if (allSelected) {
                for (const asset of filteredAssets) next.delete(asset.docId);
            } else {
                for (const asset of filteredAssets) next.add(asset.docId);
            }
            return next;
        });
    };

    const deleteAssets = async (targets: UserAsset[]) => {
        if (targets.length === 0) return;
        setIsDeleting(true);

        try {
            const deletedDocIds = new Set<string>();
            const deletedReferences: string[] = [];
            const deletedAssets: UserAsset[] = [];
            let failures = 0;

            for (const asset of targets) {
                try {
                    await assetService.deleteAsset(asset.docId, asset.url);
                    deletedDocIds.add(asset.docId);
                    deletedReferences.push(asset.url);
                    deletedAssets.push(asset);
                } catch {
                    failures++;
                }
            }

            if (deletedReferences.length > 0 && user) {
                try {
                    await sessionService.removeReferencesFromAllUserSessions(user.uid, deletedReferences);
                } catch (error) {
                    console.warn("Failed to cleanup session references after asset deletion:", error);
                    alert("Zdjęcie usunięte, ale nie udało się od razu odświeżyć wszystkich sesji. Odśwież stronę sesji.");
                }
            }

            if (deletedDocIds.size > 0) {
                setAssets((prev) => prev.filter((asset) => !deletedDocIds.has(asset.docId)));
                setSelectedDocIds((prev) => {
                    const next = new Set(prev);
                    for (const docId of deletedDocIds) next.delete(docId);
                    return next;
                });

                for (const asset of deletedAssets) {
                    if (asset.type === "face") {
                        removeFaceReference(asset.id);
                    } else if (asset.type === "office") {
                        removeOfficeReference(asset.id);
                    } else {
                        removeOutfitReference(asset.id);
                    }
                }
            }

            if (failures > 0) {
                alert(`Usunięto ${deletedDocIds.size} zdjęć. Nie udało się usunąć ${failures}.`);
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteSelected = async () => {
        const targets = filteredAssets.filter((asset) => selectedDocIds.has(asset.docId));
        if (targets.length === 0) return;

        const confirmed = confirm(
            `Usunąć ${targets.length} zdjęć? Zostaną usunięte z galerii i z Cloudflare R2.`
        );
        if (!confirmed) return;
        await deleteAssets(targets);
    };

    const handleDeleteSingle = async (asset: UserAsset, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = confirm("Usunąć to zdjęcie? Zostanie usunięte z galerii i z Cloudflare R2.");
        if (!confirmed) return;
        await deleteAssets([asset]);
    };

    if (authLoading || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans">
            <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl">
                <div className="container mx-auto flex h-16 items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
                            <Camera className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">SesjaFirmowa.pl</span>
                    </Link>

                    <div className="flex items-center gap-3">
                        {userProfile ? (
                            <div className="mr-2 hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium sm:flex">
                                <Coins className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-400">{userProfile.credits}</span>
                                <span className="text-[10px] uppercase text-blue-400/60">PKT</span>
                            </div>
                        ) : null}
                        <Link href="/sesje">
                            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                                moje sesje
                            </Button>
                        </Link>
                        <Link href="/generator">
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <Sparkles className="mr-2 h-4 w-4" /> nowa sesja
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-12 space-y-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">Moje Materiały</h1>
                        <p className="mt-2 text-zinc-400">
                            Tu widzisz wszystkie wgrane zdjęcia i decydujesz, które usunąć.
                        </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
                        Razem: <span className="font-semibold text-white">{assets.length}</span> plików
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {(Object.keys(FILTER_LABELS) as AssetFilter[]).map((filter) => (
                        <Button
                            key={filter}
                            variant="outline"
                            onClick={() => setActiveFilter(filter)}
                            className={
                                activeFilter === filter
                                    ? "border-blue-500/40 bg-blue-500/20 text-white hover:bg-blue-500/30 hover:text-white"
                                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                            }
                        >
                            {FILTER_LABELS[filter]}
                        </Button>
                    ))}

                    <div className="ml-auto flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={selectAllFiltered}
                            className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                        >
                            {selectedCount === filteredAssets.length && filteredAssets.length > 0 ? (
                                <CheckSquare className="mr-2 h-4 w-4" />
                            ) : (
                                <Square className="mr-2 h-4 w-4" />
                            )}
                            {selectedCount === filteredAssets.length && filteredAssets.length > 0 ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                        </Button>
                        <Button
                            onClick={handleDeleteSelected}
                            disabled={selectedCount === 0 || isDeleting}
                            className="bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Usuń zaznaczone ({selectedCount})
                        </Button>
                    </div>
                </div>

                {filteredAssets.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-16 text-center">
                        <Images className="mx-auto mb-4 h-10 w-10 text-zinc-500" />
                        <h2 className="text-xl font-semibold text-white">Brak zdjęć w tym widoku</h2>
                        <p className="mt-2 text-zinc-400">
                            Wgraj zdjęcia w generatorze, a tutaj pojawią się do dalszego zarządzania.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {filteredAssets.map((asset) => {
                            const selected = selectedDocIds.has(asset.docId);
                            return (
                                <div
                                    key={asset.docId}
                                    className={`group relative overflow-hidden rounded-xl border bg-zinc-900 transition-all ${
                                        selected
                                            ? "border-blue-500 ring-2 ring-blue-500/40"
                                            : "border-white/10 hover:border-white/30"
                                    }`}
                                >
                                    <button
                                        onClick={() => toggleSelection(asset.docId)}
                                        className="absolute left-2 top-2 z-20 rounded-full bg-black/70 p-1.5 text-white backdrop-blur"
                                        title={selected ? "Odznacz" : "Zaznacz"}
                                    >
                                        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                    </button>

                                    <button
                                        onClick={(e) => handleDeleteSingle(asset, e)}
                                        className="absolute right-2 top-2 z-20 rounded-full bg-red-600/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                                        title="Usuń zdjęcie"
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                        <ImageWithPlaceholder
                                            src={asset.url}
                                            alt={asset.name}
                                            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            fallbackLabel="Zdjęcie usunięte"
                                        />
                                    </a>

                                    <div className="space-y-1 border-t border-white/10 bg-black/30 p-2">
                                        <div className="flex items-center justify-between gap-2 text-[11px]">
                                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300">
                                                {TYPE_LABELS[asset.type]}
                                            </span>
                                            <span className="text-zinc-500">
                                                {asset.createdAt?.toDate().toLocaleDateString("pl-PL")}
                                            </span>
                                        </div>
                                        <p className="truncate text-xs text-zinc-400">{asset.name}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
