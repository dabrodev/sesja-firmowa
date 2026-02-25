import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as any;
        const { sessionId, uid, faceKeys, officeKeys } = body;

        if (!sessionId || !uid || !faceKeys?.length || !officeKeys?.length) {
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
            body: JSON.stringify({ sessionId, uid, faceKeys, officeKeys }),
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker error:", err);
            return NextResponse.json({ error: `Worker failed: ${err.substring(0, 200)}` }, { status: workerResp.status });
        }

        const result = await workerResp.json() as { instanceId: string; status: string };
        return NextResponse.json(result, { status: 202 });

    } catch (error: any) {
        console.error("Generate route error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
