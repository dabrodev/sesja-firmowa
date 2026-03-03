import { NextRequest, NextResponse } from "next/server";

type DeleteFileBody = {
    key?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as DeleteFileBody;
        const key = typeof body.key === "string" ? body.key.trim() : "";

        if (!key) {
            return NextResponse.json({ error: "Missing key" }, { status: 400 });
        }

        // Deletion is allowed for user uploads and generated session results.
        if (!key.startsWith("uploads/") && !key.startsWith("results/")) {
            return NextResponse.json({ error: "Invalid key prefix" }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Cloudflare Worker URL not configured" }, { status: 500 });
        }

        const workerResp = await fetch(`${workerUrl}/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
        });

        if (!workerResp.ok) {
            const errorText = await workerResp.text();
            return NextResponse.json(
                { error: `Worker delete failed: ${errorText.slice(0, 200)}` },
                { status: workerResp.status }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Delete file route error:", error);
        return NextResponse.json({ error: getErrorMessage(error, "Delete failed") }, { status: 500 });
    }
}
