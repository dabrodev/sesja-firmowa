import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2";

export async function POST(req: NextRequest) {
    try {
        const { keys } = await req.json();

        if (!keys || !Array.isArray(keys)) {
            return NextResponse.json(
                { error: "Missing or invalid keys array" },
                { status: 400 }
            );
        }

        const bucketName = process.env.R2_BUCKET_NAME;

        const signedUrls = await Promise.all(
            keys.map(async (key) => {
                const command = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                });
                const url = await getSignedUrl(r2Client, command, { expiresIn: 86400 });
                return { key, url };
            })
        );

        return NextResponse.json({ urls: signedUrls });
    } catch (error) {
        console.error("Error generating view URLs:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
