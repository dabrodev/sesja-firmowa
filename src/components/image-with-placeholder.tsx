"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageWithPlaceholderProps = {
    src?: string;
    alt: string;
    className?: string;
    fallbackClassName?: string;
    fallbackLabel?: string;
    draggable?: boolean;
};

export function ImageWithPlaceholder({
    src,
    alt,
    className,
    fallbackClassName,
    fallbackLabel = "Zdjęcie usunięte",
    draggable,
}: ImageWithPlaceholderProps) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const hasError = !src || failedSrc === src;

    if (hasError || !src) {
        return (
            <div
                className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-2 bg-black/40 px-2 text-center",
                    fallbackClassName
                )}
            >
                <ImageOff className="h-5 w-5 text-zinc-500" />
                <span className="text-[11px] text-zinc-400">{fallbackLabel}</span>
            </div>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            draggable={draggable}
            className={className}
            onError={() => setFailedSrc(src)}
        />
    );
}
