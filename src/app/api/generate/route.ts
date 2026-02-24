import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, uid, faceUrls, officeUrls } = body;

        if (!sessionId || !uid || !faceUrls?.length || !officeUrls?.length) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json(
                { error: "Cloudflare Worker URL not configured" },
                { status: 500 }
            );
        }

        console.log(`[Generate] Calling worker for session ${sessionId}`);

        const workerResp = await fetch(`${workerUrl}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, uid, faceUrls, officeUrls }),
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker error:", err);
            return NextResponse.json(
                { error: `Worker failed: ${err.substring(0, 200)}` },
                { status: workerResp.status }
            );
        }

        const result = await workerResp.json();
        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Generate route error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
