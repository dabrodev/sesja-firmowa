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

        // Upload the file to the Worker (uses R2 binding — no S3 permission needed)
        const workerForm = new FormData();
        workerForm.append("file", file);

        const workerResp = await fetch(`${workerUrl}/upload`, {
            method: "POST",
            body: workerForm,
        });

        if (!workerResp.ok) {
            const err = await workerResp.text();
            console.error("Worker upload error:", err);
            return NextResponse.json({ error: "Upload to R2 failed" }, { status: 500 });
        }

        const { key } = await workerResp.json() as { key: string };

        // Generate a signed GET URL for viewing (24h) using read-capable S3 credentials
        const viewUrl = await getSignedUrl(
            r2Client,
            new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME!,
                Key: key,
            }),
            { expiresIn: 86400 }
        );

        return NextResponse.json({ viewUrl, key });

    } catch (error: any) {
        console.error("Upload route error:", error);
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
