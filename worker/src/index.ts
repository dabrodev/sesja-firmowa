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
        // Variations = pose/angle/framing — NOT expression (preserve natural expression from reference photos)
        const variations = [
            "Scene: person looking directly at camera, upper body framing, natural moment between tasks. Maintain their EXACT natural facial expression from the reference photos — do not alter it.",
            "Scene: person working at laptop or reviewing documents at their desk, slightly angled, candid moment of focused work. Maintain their EXACT natural facial expression from the reference photos.",
            "Scene: person in mid-conversation or presenting — gesturing naturally or leaning forward, engaged posture, 3/4 body framing. Maintain their EXACT natural facial expression from the reference photos.",
            "Scene: person standing near a window or by their workspace, looking thoughtfully to the side, candid documentary-style framing. Maintain their EXACT natural facial expression from the reference photos.",
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

        // Generate a custom image directly without workflow
        if (url.pathname === "/generate-custom") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
            }
            try {
                const body = await request.json() as { prompt: string; referenceKeys?: string[] };
                const { prompt, referenceKeys } = body;

                if (!prompt) {
                    return new Response(JSON.stringify({ error: "Missing required field: prompt" }), {
                        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                    });
                }

                console.log(`[Custom Generator] Prompt: ${prompt}, References: ${referenceKeys?.length || 0}`);
                const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

                // Fetch reference images if provided
                let refImages: { base64: string; mimeType: string }[] = [];
                if (referenceKeys && referenceKeys.length > 0) {
                    refImages = await fetchImagesFromR2(env, referenceKeys);
                }

                // Append the requested 5:4 aspect ratio directive to the prompt
                const finalPrompt = `${prompt}\n\n[Instruction: Create image in 5:4 aspect ratio]`;

                const parts: any[] = [{ text: finalPrompt }];
                if (refImages.length > 0) {
                    parts.push({ text: `\nREFERENCE PHOTOS (${refImages.length} images):\nPlease use these images as a visual reference for the subject, style, or composition as described in the prompt.` });
                    for (const img of refImages) {
                        parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
                    }
                }

                const response = await ai.models.generateContent({
                    model: "gemini-3.1-flash-image-preview",
                    contents: [{ role: "user", parts }],
                    config: {
                        responseModalities: ["TEXT", "IMAGE"],
                        // Gemini's generateContent doesn't natively expose image aspect ratio in the base config,
                        // but sometimes setting it in output configs works. We enforce it in the prompt above.
                    },
                });

                let base64Image = null;
                for (const part of response.candidates?.[0]?.content?.parts ?? []) {
                    if (part.inlineData?.data) {
                        base64Image = part.inlineData.data;
                        break;
                    }
                }

                if (!base64Image) {
                    throw new Error("Gemini returned no image for the custom prompt");
                }

                // Save to R2
                const key = `uploads/custom-${Date.now()}.jpg`;
                const imageData = base64ToArrayBuffer(base64Image);
                await env.MEDIA_BUCKET.put(key, imageData, {
                    httpMetadata: { contentType: "image/jpeg" },
                });

                const workerUrl = WORKER_URL;
                const publicUrl = `${workerUrl}/file?key=${encodeURIComponent(key)}`;

                return new Response(JSON.stringify({ url: publicUrl, success: true }), {
                    status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            } catch (error: any) {
                console.error("Custom generation error:", error);
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
    const systemPrompt = `You are a professional photography prompt engineer specializing in corporate business photo sessions.
Create a prompt for a high-end business photo session — NOT a passport or ID headshot.`;

    const userMessage = `I have ${faceCount} face reference photo(s) and ${officeCount} office/workspace reference photo(s).

Generate a photorealistic business photo session prompt that instructs the AI to:
1. Preserve EXACTLY: the person's face structure, skin tone, hair color/style, and any visible clothing/outfit from the reference photos
2. CRITICAL: Preserve the person's NATURAL facial expression from the reference photos — do NOT add a smile or change their expression
3. Place the person in the EXACT office environment shown in the office reference photos (same walls, furniture, lighting setup, color palette)
4. Photography style: natural window light blended with soft studio fill, 85mm lens, f/2.0 bokeh, full or 3/4 body framing
5. Result: a polished, high-end corporate business photo suitable for LinkedIn, press materials, and company websites

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
    return `Photorealistic professional business photo session. Preserve the person's exact face, skin tone, hair, clothing, and NATURAL EXPRESSION from the reference photos — do not alter their expression. Place them in the exact office environment shown in the workspace reference photos. Natural window light with soft studio fill, 85mm f/2.0, warm professional color grading.`;
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
        text: `PHOTO SESSION STYLE: ${prompt}\n\nVARIATION INSTRUCTIONS: ${variation}\n\nIMPORTANT: Do NOT invent or change the person's facial expression. Reproduce it exactly as it appears in the reference photos. If they look neutral, keep it neutral. If they are slightly smiling, keep that. This should look like a REAL professional business photo session — not a passport photo, not an illustration.`,
    });

    console.log(`[Gemini] Calling API for variation: ${variation}`);

    // Throws on error — allows Workflow to retry the step
    const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
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
    const chunk = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
        // @ts-ignore
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
