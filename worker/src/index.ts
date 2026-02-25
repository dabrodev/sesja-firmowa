/// <reference types="@cloudflare/workers-types" />
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { GoogleGenAI } from "@google/genai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Env {
    MEDIA_BUCKET: R2Bucket;
    GENERATION_WORKFLOW: Workflow;
    GEMINI_API_KEY: string;
    AZURE_OPENAI_ENDPOINT: string;
    AZURE_OPENAI_API_KEY: string;
    AZURE_OPENAI_DEPLOYMENT_NAME: string;
    AZURE_OPENAI_API_VERSION: string;
    CLOUDFLARE_ACCOUNT_ID: string;
}

type GenerateParams = {
    sessionId: string;
    uid: string;
    faceKeys: string[];
    officeKeys: string[];
};

type WorkerUrl = "https://sesja-firmowa.damiandabrodev.workers.dev";
const WORKER_URL: WorkerUrl = "https://sesja-firmowa.damiandabrodev.workers.dev";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ─── Cloudflare Workflow ──────────────────────────────────────────────────────

export class GenerationWorkflow extends WorkflowEntrypoint<Env, GenerateParams> {
    async run(event: WorkflowEvent<GenerateParams>, step: WorkflowStep) {
        const { sessionId, faceKeys, officeKeys } = event.payload;

        // Step 1: Generate a tailored prompt using Azure OpenAI
        const prompt = await step.do("generate-prompt", {
            retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
        }, async () => {
            return await generatePromptWithAzure(this.env, faceKeys.length, officeKeys.length);
        });

        const workerUrl = WORKER_URL;
        const resultKeys: string[] = [];

        // Steps 2-5: Generate each variation independently (1 step per image)
        // This keeps step results small (just R2 key strings, not base64 images)
        const variations = [
            "Direct eye contact, confident professional smile.",
            "Three-quarter profile, thoughtful expression.",
            "Looking slightly off-camera, serious authoritative expression.",
            "Looking directly at camera, warm approachable smile.",
        ];

        for (let i = 0; i < variations.length; i++) {
            const variation = variations[i];
            const key = await step.do(`generate-variation-${i + 1}`, {
                retries: { limit: 2, delay: "10 seconds", backoff: "linear" },
            }, async () => {
                // Fetch reference images fresh from R2 in each step
                const [faceImages, officeImages] = await Promise.all([
                    fetchImagesFromR2(this.env, faceKeys.slice(0, 4)),
                    fetchImagesFromR2(this.env, officeKeys.slice(0, 2)),
                ]);

                // Generate one image with Gemini
                const base64Image = await generateOneImage(this.env, prompt, variation, faceImages, officeImages);

                // Save immediately to R2 — return only the key (small string)
                const resultKey = `results/${sessionId}/photo-${i + 1}.jpg`;
                if (base64Image) {
                    const imageData = base64ToArrayBuffer(base64Image);
                    await this.env.MEDIA_BUCKET.put(resultKey, imageData, {
                        httpMetadata: { contentType: "image/jpeg" },
                    });
                    return resultKey;
                }
                return null;
            });

            if (key) resultKeys.push(key);
        }

        // Build result URLs (served via Worker's /file endpoint)
        const resultUrls = resultKeys.map(k => `${workerUrl}/file?key=${encodeURIComponent(k)}`);

        return { resultUrls, sessionId };
    }
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Health check
        if (url.pathname === "/" || url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", worker: "sesja-firmowa" }), {
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        // Upload reference photos via R2 binding
        if (url.pathname === "/upload") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
            }
            return handleUpload(request, env);
        }

        // Serve files from R2 binding
        if (url.pathname === "/file") {
            const key = url.searchParams.get("key");
            if (!key) {
                return new Response(JSON.stringify({ error: "Missing key" }), {
                    status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
            const object = await env.MEDIA_BUCKET.get(key);
            if (!object) {
                return new Response("Not found", { status: 404, headers: CORS_HEADERS });
            }
            const contentType = object.httpMetadata?.contentType || "image/jpeg";
            return new Response(object.body, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=86400",
                },
            });
        }

        // Start a generation workflow — returns immediately with instanceId
        if (url.pathname === "/generate") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
            }
            try {
                const body = await request.json() as GenerateParams;
                const { sessionId, uid, faceKeys, officeKeys } = body;

                if (!sessionId || !uid || !faceKeys?.length || !officeKeys?.length) {
                    return new Response(JSON.stringify({ error: "Missing required fields" }), {
                        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                    });
                }

                // Create workflow instance — runs in background
                const instance = await env.GENERATION_WORKFLOW.create({
                    id: sessionId,
                    params: { sessionId, uid, faceKeys, officeKeys },
                });

                return new Response(JSON.stringify({ instanceId: instance.id, status: "queued" }), {
                    status: 202, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
        }

        // Poll workflow status
        if (url.pathname === "/status") {
            const instanceId = url.searchParams.get("instanceId");
            if (!instanceId) {
                return new Response(JSON.stringify({ error: "Missing instanceId" }), {
                    status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
            try {
                const instance = await env.GENERATION_WORKFLOW.get(instanceId);
                const status = await instance.status();

                return new Response(JSON.stringify({
                    status: status.status,
                    output: status.output ?? null,
                    error: status.error ?? null,
                }), {
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
        }

        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    },
};

// ─── Handle file uploads ──────────────────────────────────────────────────────

async function handleUpload(request: Request, env: Env): Promise<Response> {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return new Response(JSON.stringify({ error: "No file provided" }), {
                status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        const key = `uploads/${Date.now()}-${file.name}`;
        const buffer = await file.arrayBuffer();

        await env.MEDIA_BUCKET.put(key, buffer, {
            httpMetadata: { contentType: file.type || "image/jpeg" },
        });

        return new Response(JSON.stringify({ key, success: true }), {
            status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || "Upload failed" }), {
            status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }
}

// ─── Fetch images from R2 ─────────────────────────────────────────────────────

async function fetchImagesFromR2(env: Env, keys: string[]): Promise<{ base64: string; mimeType: string }[]> {
    const results = await Promise.all(
        keys.map(async (key) => {
            const object = await env.MEDIA_BUCKET.get(key);
            if (!object) throw new Error(`R2 object not found: ${key}`);
            const buffer = await object.arrayBuffer();
            const base64 = arrayBufferToBase64(buffer);
            const mimeType = object.httpMetadata?.contentType || "image/jpeg";
            return { base64, mimeType: mimeType.split(";")[0] };
        })
    );
    return results;
}

// ─── Generate prompt with Azure OpenAI ───────────────────────────────────────

async function generatePromptWithAzure(env: Env, faceCount: number, officeCount: number): Promise<string> {
    const systemPrompt = `You are a professional photography prompt engineer specializing in corporate headshots.
Create a concise but detailed image generation prompt based on the reference photos provided.`;

    const userMessage = `I have ${faceCount} face reference photo(s) and ${officeCount} office/workspace reference photo(s).

Generate a photorealistic corporate headshot prompt that instructs the AI to:
1. Preserve EXACTLY: the person's face structure, skin tone, hair color/style, and any visible clothing/outfit from the reference photos
2. Place the person in the EXACT office environment shown in the office reference photos (same walls, furniture, lighting setup, color palette)
3. Use professional photography settings: natural window light blended with soft studio fill, 85mm lens, f/2.0 bokeh
4. Result: a polished, high-end corporate headshot suitable for LinkedIn and business profiles

Generate ONLY the image prompt text. 2-3 sentences maximum.`;

    const resp = await fetch(
        `${env.AZURE_OPENAI_ENDPOINT}openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": env.AZURE_OPENAI_API_KEY },
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
        console.error("Azure OpenAI error:", await resp.text());
        return getDefaultPrompt();
    }

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content || getDefaultPrompt();
}

function getDefaultPrompt(): string {
    return `Photorealistic professional corporate headshot. Preserve the person's exact face, skin tone, hair, and clothing from the reference photos. Place them in the exact office environment shown in the workspace reference photos. Natural window light with soft studio fill, 85mm f/2.0, warm professional color grading.`;
}

// ─── Generate one image with Gemini ──────────────────────────────────────────

async function generateOneImage(
    env: Env,
    prompt: string,
    variation: string,
    faceImages: { base64: string; mimeType: string }[],
    officeImages: { base64: string; mimeType: string }[]
): Promise<string> {  // throws on failure — workflow will retry
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const parts: any[] = [];

    parts.push({
        text: `FACE REFERENCE PHOTOS (${faceImages.length} images):\nThese show the EXACT person to photograph. You MUST:\n- Preserve their face structure, skin tone, eye color, nose shape, jawline 100% accurately\n- Keep their hair color, length, and style EXACTLY as shown\n- Reproduce their clothing/outfit/style precisely — same colors, fabric, neckline`,
    });
    for (const img of faceImages) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }

    parts.push({
        text: `OFFICE/WORKSPACE REFERENCE PHOTOS (${officeImages.length} images):\nThis is the EXACT environment for the photo. You MUST:\n- Use this specific office space as the background/setting\n- Match the wall colors, furniture, decor, window placement, and ambient lighting\n- Keep the environment recognizable and consistent with these photos`,
    });
    for (const img of officeImages) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }

    parts.push({
        text: `PHOTO STYLE: ${prompt}\n\nVARIATION: ${variation}\n\nGENERATE a single professional corporate headshot photo now. Must look like a real photograph — not an illustration or painting.`,
    });

    console.log(`[Gemini] Calling API for variation: ${variation}`);

    // Throws on error — allows Workflow to retry the step
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    console.log(`[Gemini] Response candidates: ${response.candidates?.length ?? 0}`);

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
            console.log(`[Gemini] Got image data for variation: ${variation}`);
            return part.inlineData.data;
        }
    }

    throw new Error(`Gemini returned no image for variation: ${variation}`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
