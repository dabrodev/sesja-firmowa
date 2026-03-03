import { NextRequest, NextResponse } from "next/server";

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export async function GET(req: NextRequest) {
    try {
        const instanceId = req.nextUrl.searchParams.get("instanceId");
        const runId = req.nextUrl.searchParams.get("runId");
        if (!instanceId) {
            return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Worker URL not configured" }, { status: 500 });
        }

        const workerStatusUrl = new URL(`${workerUrl}/status`);
        workerStatusUrl.searchParams.set("instanceId", instanceId);
        if (runId) {
            workerStatusUrl.searchParams.set("runId", runId);
        }

        const resp = await fetch(workerStatusUrl.toString());
        const data = await resp.json() as { status: string; output?: { resultUrls: string[] }; error?: string };

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error("Status route error:", error);
        return NextResponse.json({ error: getErrorMessage(error, "Failed to get status") }, { status: 500 });
    }
}
