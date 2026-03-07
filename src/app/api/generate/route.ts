import { NextRequest, NextResponse } from "next/server";
import { normalizeRequestedCount } from "@/lib/requested-count";
import { toUserFacingWorkerError } from "@/lib/worker-error";

type GenerateRequestBody = {
    sessionId: string;
    uid: string;
    faceKeys: string[];
    officeKeys: string[];
    outfitKeys?: string[];
    customPrompt?: string;
    requestedCount?: number;
    runId?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as Partial<GenerateRequestBody>;
        const {
            sessionId,
            uid,
            faceKeys,
            officeKeys = [],
            outfitKeys = [],
            customPrompt,
            requestedCount,
            runId,
        } = body;
        const safeRequestedCount = normalizeRequestedCount(requestedCount);

        if (
            !sessionId ||
            !uid ||
            !Array.isArray(faceKeys) ||
            faceKeys.length === 0 ||
            !Array.isArray(officeKeys) ||
            !Array.isArray(outfitKeys)
        ) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Cloudflare Worker URL not configured" }, { status: 500 });
        }

        console.log(`[Generate] Starting workflow for session ${sessionId}`);

        // Fire and forget — Worker creates a Workflow and returns instanceId immediately
        const workerResp = await fetch(`${workerUrl}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId,
                uid,
                faceKeys,
                officeKeys,
                outfitKeys,
                customPrompt: typeof customPrompt === "string" ? customPrompt.trim() : "",
                requestedCount: safeRequestedCount,
                runId: typeof runId === "string" && runId.trim().length > 0 ? runId.trim() : Date.now().toString(),
            }),
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker error:", err);
            return NextResponse.json(
                {
                    error: toUserFacingWorkerError(
                        err,
                        "Nie udało się uruchomić generowania. Spróbuj ponownie za chwilę.",
                        workerResp.status
                    ),
                },
                { status: workerResp.status }
            );
        }

        const result = await workerResp.json() as { instanceId: string; status: string };
        return NextResponse.json(result, { status: 202 });

    } catch (error: unknown) {
        console.error("Generate route error:", error);
        return NextResponse.json({ error: getErrorMessage(error, "Internal Server Error") }, { status: 500 });
    }
}
