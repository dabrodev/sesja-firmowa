import { NextRequest, NextResponse } from "next/server";
import { toUserFacingWorkerError } from "@/lib/worker-error";

type GenerateCustomRequestBody = {
    prompt: string;
    referenceKeys?: string[];
    editImageUrl?: string;
    editImageKey?: string;
    maskDataUrl?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as Partial<GenerateCustomRequestBody>;
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const referenceKeys = Array.isArray(body.referenceKeys) ? body.referenceKeys : [];
        const editImageUrl = typeof body.editImageUrl === "string" ? body.editImageUrl.trim() : "";
        const editImageKey = typeof body.editImageKey === "string" ? body.editImageKey.trim() : "";
        const maskDataUrl = typeof body.maskDataUrl === "string" ? body.maskDataUrl.trim() : "";

        if (!prompt.length) {
            return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
        }

        const hasEditTarget = editImageKey.length > 0 || editImageUrl.length > 0;
        if (hasEditTarget && !maskDataUrl.startsWith("data:image/")) {
            return NextResponse.json({ error: "Maska jest wymagana w trybie edycji." }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Cloudflare Worker URL not configured" }, { status: 500 });
        }

        console.log(`[Generate Custom] Forwarding request to worker with prompt: ${prompt}`);

        const workerResp = await fetch(`${workerUrl}/generate-custom`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt,
                referenceKeys,
                ...(editImageUrl ? { editImageUrl } : {}),
                ...(editImageKey ? { editImageKey } : {}),
                ...(maskDataUrl ? { maskDataUrl } : {}),
            }),
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker error:", err);
            return NextResponse.json(
                {
                    error: toUserFacingWorkerError(
                        err,
                        "Nie udało się wygenerować obrazu. Spróbuj ponownie za chwilę.",
                        workerResp.status
                    ),
                },
                { status: workerResp.status }
            );
        }

        const result = await workerResp.json() as { url: string; success: boolean };
        return NextResponse.json(result, { status: 200 });

    } catch (error: unknown) {
        console.error("Generate Custom route error:", error);
        return NextResponse.json({ error: getErrorMessage(error, "Internal Server Error") }, { status: 500 });
    }
}
