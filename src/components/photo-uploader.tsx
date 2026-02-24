"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileImage, CheckCircle2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PhotoAsset } from "@/lib/store";

interface PhotoUploaderProps {
    onUpload: (asset: PhotoAsset) => void;
    onRemove: (id: string) => void;
    assets: PhotoAsset[];
    title: string;
    description: string;
    maxFiles?: number;
}

export function PhotoUploader({
    onUpload,
    onRemove,
    assets,
    title,
    description,
    maxFiles = 5,
}: PhotoUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            setIsUploading(true);

            try {
                for (const file of acceptedFiles) {
                    if (assets.length >= maxFiles) break;

                    // Upload via Next.js server — no CORS issues
                    const formData = new FormData();
                    formData.append("file", file);

                    const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                    });

                    if (!res.ok) throw new Error("Upload failed");
                    const { viewUrl, key } = await res.json() as { viewUrl: string; key: string };

                    onUpload({
                        id: key,
                        url: viewUrl,
                        name: file.name,
                        size: file.size,
                    });
                }
            } catch (error) {
                console.error("Upload error:", error);
            } finally {
                setIsUploading(false);
            }
        },
        [onUpload, assets, maxFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "image/*": [] },
        disabled: assets.length >= maxFiles || isUploading,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-sm text-zinc-400">{description}</p>
                </div>
                <div className="text-xs font-medium text-zinc-500">
                    {assets.length} / {maxFiles} files
                </div>
            </div>

            <div
                {...getRootProps()}
                className={cn(
                    "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/5 py-12 transition-all hover:bg-white/[0.08]",
                    isDragActive && "border-blue-500 bg-blue-500/10",
                    (assets.length >= maxFiles || isUploading) && "cursor-not-allowed opacity-50"
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                    {isUploading ? (
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    ) : (
                        <Upload className="h-10 w-10 text-zinc-500" />
                    )}
                    <div className="text-sm font-medium text-zinc-300">
                        {isDragActive ? "Drop images here" : "Click or drag images to upload"}
                    </div>
                    <p className="text-xs text-zinc-500">Supports JPG, PNG, WEBP (Max 5MB)</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <AnimatePresence>
                    {assets.map((asset) => (
                        <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
                        >
                            <img
                                src={asset.url}
                                alt={asset.name}
                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                            <button
                                onClick={() => onRemove(asset.id)}
                                className="absolute top-2 right-2 rounded-full bg-red-500/80 p-1 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                Verified
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
