import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const instanceId = req.nextUrl.searchParams.get("instanceId");
        if (!instanceId) {
            return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Worker URL not configured" }, { status: 500 });
        }

        const resp = await fetch(`${workerUrl}/status?instanceId=${encodeURIComponent(instanceId)}`);
        const data = await resp.json() as { status: string; output?: { resultUrls: string[] }; error?: string };

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Status route error:", error);
        return NextResponse.json({ error: error.message || "Failed to get status" }, { status: 500 });
    }
}
