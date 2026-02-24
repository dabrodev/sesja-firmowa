import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
        if (!workerUrl) {
            return NextResponse.json({ error: "Worker URL not configured" }, { status: 500 });
        }

        // Upload via Worker R2 binding (EU jurisdiction, native access — no S3 creds needed)
        const workerForm = new FormData();
        workerForm.append("file", file);

        const workerResp = await fetch(`${workerUrl}/upload`, {
            method: "POST",
            body: workerForm,
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker upload error:", err);
            return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        const { key } = await workerResp.json() as { key: string };

        // Use Worker's /file endpoint for all access — same R2 EU binding
        const viewUrl = `${workerUrl}/file?key=${encodeURIComponent(key)}`;

        return NextResponse.json({ viewUrl, key });

    } catch (error: any) {
        console.error("Upload route error:", error);
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
