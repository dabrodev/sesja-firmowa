import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as { prompt: string; referenceKeys?: string[] };
        const { prompt, referenceKeys } = body;

        if (!prompt) {
            return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Cloudflare Worker URL not configured" }, { status: 500 });
        }

        console.log(`[Generate Custom] Forwarding request to worker with prompt: ${prompt}`);

        const workerResp = await fetch(`${workerUrl}/generate-custom`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, referenceKeys }),
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker error:", err);
            return NextResponse.json({ error: `Worker failed: ${err.substring(0, 200)}` }, { status: workerResp.status });
        }

        const result = await workerResp.json() as { url: string; success: boolean };
        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error("Generate Custom route error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
