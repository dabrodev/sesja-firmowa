import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const key = `uploads/${Date.now()}-${file.name}`;
        const bucketName = process.env.R2_BUCKET_NAME!;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload server-side — no CORS issues
        await r2Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: file.type,
        }));

        // Generate a signed GET URL for viewing (24h)
        const viewUrl = await getSignedUrl(
            r2Client,
            new GetObjectCommand({ Bucket: bucketName, Key: key }),
            { expiresIn: 86400 }
        );

        return NextResponse.json({ viewUrl, key });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
