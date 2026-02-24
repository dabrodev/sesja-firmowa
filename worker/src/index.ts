/// <reference types="@cloudflare/workers-types" />

export interface Env {
    MEDIA_BUCKET: R2Bucket;
    GEMINI_API_KEY: string;
    AZURE_OPENAI_ENDPOINT: string;
    AZURE_OPENAI_API_KEY: string;
    AZURE_OPENAI_DEPLOYMENT_NAME: string;
    AZURE_OPENAI_API_VERSION: string;
    CLOUDFLARE_ACCOUNT_ID: string;
}

interface GenerateRequest {
    sessionId: string;
    uid: string;
    faceUrls: string[];    // Signed R2 URLs for face reference photos
    officeUrls: string[];  // Signed R2 URLs for office/background photos
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Health check
        if (url.pathname === "/" || url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", worker: "sesja-firmowa" }), {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
            });
        }

        if (url.pathname !== "/generate") {
            return new Response(JSON.stringify({ error: "Not found" }), {
                status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
        }

        try {
            const body = await request.json() as GenerateRequest;
            const { sessionId, uid, faceUrls, officeUrls } = body;

            if (!sessionId || !uid || !faceUrls?.length || !officeUrls?.length) {
                return new Response(
                    JSON.stringify({ error: "Missing required fields" }),
                    { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
                );
            }

            console.log(`[${sessionId}] Starting generation for user ${uid}`);
            console.log(`[${sessionId}] Face refs: ${faceUrls.length}, Office refs: ${officeUrls.length}`);

            // Step 1: Fetch all reference images and convert to base64
            const [faceBase64Array, officeBase64Array] = await Promise.all([
                fetchImagesToBase64(faceUrls.slice(0, 4)), // Max 4 face refs
                fetchImagesToBase64(officeUrls.slice(0, 2)), // Max 2 office refs
            ]);

            console.log(`[${sessionId}] Images fetched successfully`);

            // Step 2: Generate detailed prompt using Azure OpenAI
            const enhancedPrompt = await generatePromptWithAzure(env, faceBase64Array, officeBase64Array);
            console.log(`[${sessionId}] Prompt generated: ${enhancedPrompt.substring(0, 100)}...`);

            // Step 3: Generate 4 images with Gemini using references
            const generatedImages = await generateImagesWithGemini(
                env,
                enhancedPrompt,
                faceBase64Array,
                officeBase64Array
            );

            console.log(`[${sessionId}] Generated ${generatedImages.length} images`);

            // Step 4: Upload generated images to R2
            const resultUrls = await uploadResultsToR2(env, sessionId, generatedImages);

            console.log(`[${sessionId}] Uploaded to R2: ${resultUrls.length} images`);

            return new Response(
                JSON.stringify({ resultUrls, count: resultUrls.length }),
                { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );

        } catch (error: any) {
            console.error("Worker error:", error);
            return new Response(
                JSON.stringify({ error: error.message || "Internal Server Error" }),
                { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }
    },
};

// ─── Helper: Fetch images and convert to base64 ──────────────────────────────

async function fetchImagesToBase64(urls: string[]): Promise<{ base64: string; mimeType: string }[]> {
    const results = await Promise.all(
        urls.map(async (url) => {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Failed to fetch image: ${url} (${resp.status})`);
            const buffer = await resp.arrayBuffer();
            const base64 = arrayBufferToBase64(buffer);
            const mimeType = resp.headers.get("content-type") || "image/jpeg";
            return { base64, mimeType: mimeType.split(";")[0] };
        })
    );
    return results;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ─── Helper: Generate prompt with Azure OpenAI ───────────────────────────────

async function generatePromptWithAzure(
    env: Env,
    _faceImages: { base64: string; mimeType: string }[],
    _officeImages: { base64: string; mimeType: string }[]
): Promise<string> {
    const systemPrompt = `You are a professional photography prompt engineer specializing in corporate headshots and business photography. 
Create a highly detailed, photorealistic image generation prompt for a corporate photoshoot session.`;

    const userMessage = `Generate a professional corporate photography prompt for a business headshot session.
The images provided show the person's face references and office/workspace environment.

Requirements for the prompt:
- Photorealistic, professional corporate headshot
- Natural office lighting (window light + soft studio fill)
- The person should look confident and approachable
- Business attire appropriate for Polish corporate culture
- Sharp focus on face, slightly blurred background (bokeh)
- High-end camera quality feel (shot on Sony A7R V, 85mm lens, f/2.0)
- Color grading: clean, professional, slightly warm tones

Generate ONLY the image prompt, nothing else. Make it 2-3 sentences.`;

    const resp = await fetch(
        `${env.AZURE_OPENAI_ENDPOINT}openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": env.AZURE_OPENAI_API_KEY,
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                max_tokens: 300,
                temperature: 0.7,
            }),
        }
    );

    if (!resp.ok) {
        const err = await resp.text();
        console.error("Azure OpenAI error:", err);
        // Fallback to default prompt
        return getDefaultPrompt();
    }

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content || getDefaultPrompt();
}

function getDefaultPrompt(): string {
    return `Professional corporate headshot of a business person in a modern Polish office environment. 
Natural window light with soft studio fill, shot on Sony A7R V with 85mm lens at f/2.0. 
Photorealistic, sharp focus on face with beautiful bokeh background, warm professional color grading.`;
}

// ─── Helper: Generate images with Gemini ─────────────────────────────────────

async function generateImagesWithGemini(
    env: Env,
    prompt: string,
    faceImages: { base64: string; mimeType: string }[],
    officeImages: { base64: string; mimeType: string }[]
): Promise<string[]> {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const chat = ai.chats.create({
        model: "gemini-3-pro-image-preview",
        config: {
            responseModalities: ["TEXT", "IMAGE"],
        },
    });

    // Build message with all reference images inline
    const parts: any[] = [];

    parts.push({ text: "Face reference photos of the person (maintain this person's identity exactly in the generated image):" });
    for (const img of faceImages) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }

    parts.push({ text: "Office/workspace reference photos (use this environment as the background/setting):" });
    for (const img of officeImages) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }

    parts.push({ text: prompt });

    const results: string[] = [];

    const variations = [
        "Generate variation 1: Direct eye contact, confident professional smile.",
        "Generate variation 2: Three-quarter profile, thoughtful expression.",
        "Generate variation 3: Looking slightly off-camera, serious expression.",
        "Generate variation 4: Looking directly at camera, warm approachable smile.",
    ];

    // First message — includes all reference images + base prompt + first variation
    try {
        const firstMessage = [...parts, { text: variations[0] }];
        const response = await chat.sendMessage({ message: firstMessage });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
                results.push(part.inlineData.data);
                break;
            }
        }
    } catch (err) {
        console.error("Variation 1 failed:", err);
    }

    // Subsequent variations just send a short text prompt (chat retains context)
    for (let i = 1; i < variations.length; i++) {
        try {
            const response = await chat.sendMessage({ message: variations[i] });
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    results.push(part.inlineData.data);
                    break;
                }
            }
        } catch (err) {
            console.error(`Variation ${i + 1} failed:`, err);
        }
    }

    return results;
}

// ─── Helper: Upload results to R2 ────────────────────────────────────────────

async function uploadResultsToR2(
    env: Env,
    sessionId: string,
    base64Images: string[]
): Promise<string[]> {
    const urls: string[] = [];
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;

    for (let i = 0; i < base64Images.length; i++) {
        const key = `results/${sessionId}/photo-${i + 1}.jpg`;
        const imageData = base64ToArrayBuffer(base64Images[i]);

        await env.MEDIA_BUCKET.put(key, imageData, {
            httpMetadata: { contentType: "image/jpeg" },
        });

        // Construct public URL (requires R2 public access or custom domain)
        // Using the Cloudflare R2 public URL format
        const publicUrl = `https://pub-${accountId}.r2.dev/${key}`;
        urls.push(publicUrl);
    }

    return urls;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
