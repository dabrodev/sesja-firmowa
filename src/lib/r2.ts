import { S3Client } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    // R2 does not support checksum validation — newer AWS SDK adds it by default
    requestChecksumCalculation: "WHEN_REQUIRED" as any,
    responseChecksumValidation: "WHEN_REQUIRED" as any,
});

export { r2Client };
