import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2";

export async function POST(req: NextRequest) {
    try {
        const { filename, contentType } = await req.json();

        if (!filename || !contentType) {
            return NextResponse.json(
                { error: "Missing filename or contentType" },
                { status: 400 }
            );
        }

        const key = `uploads/${Date.now()}-${filename}`;
        const bucketName = process.env.R2_BUCKET_NAME;

        // Command for uploading
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: contentType,
        });

        // Command for reading (signed URL)
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        // Generate both URLs
        const uploadUrl = await getSignedUrl(r2Client, putCommand, { expiresIn: 3600 });
        const viewUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 86400 }); // 24h for viewing

        return NextResponse.json({
            uploadUrl: uploadUrl,
            viewUrl: viewUrl,
            key: key,
        });
    } catch (error) {
        console.error("Error generating signed URLs:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
