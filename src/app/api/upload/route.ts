import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2";

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

        // 1. Upload via Worker R2 binding (EU jurisdiction, native access)
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

        // 2. Generate signed GET URL from S3 EU credentials (read-only is enough for GET)
        //    This URL is accessible both from the browser and from the Worker during generation
        const viewUrl = await getSignedUrl(
            r2Client,
            new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
            }),
            { expiresIn: 86400 } // 24h
        );

        return NextResponse.json({ viewUrl, key });

    } catch (error: any) {
        console.error("Upload route error:", error);
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
