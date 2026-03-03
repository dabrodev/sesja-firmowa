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
    outfitKeys?: string[];
    customPrompt?: string;
    requestedCount?: number;
    runId?: string;
    workflowInstanceId?: string;
};

type WorkerUrl = "https://sesja-firmowa.damiandabrodev.workers.dev";
const WORKER_URL: WorkerUrl = "https://sesja-firmowa.damiandabrodev.workers.dev";

type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

type AzureChatCompletionResponse = {
    choices?: Array<{ message?: { content?: string } }>;
};

type PromptDebugImagePrompt = {
    index: number;
    variation: string;
    finalPrompt: string;
};

type PromptDebugPayload = {
    runId: string;
    workflowInstanceId: string;
    stylePrompt: string;
    customPrompt: string;
    prioritizeOutfit: boolean;
    imagePrompts: PromptDebugImagePrompt[];
    createdAtIso: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
    const normalized = getReadableError(error);
    return normalized || fallback;
}

function getReadableError(error: unknown): string | null {
    if (!error) return null;
    if (error instanceof Error) return error.message || null;

    if (typeof error === "string") {
        const trimmed = error.trim();
        if (!trimmed) return null;
        try {
            const parsed = JSON.parse(trimmed) as { message?: unknown; error?: unknown };
            if (typeof parsed.message === "string" && parsed.message.trim()) {
                return parsed.message;
            }
            if (typeof parsed.error === "string" && parsed.error.trim()) {
                return parsed.error;
            }
        } catch {
            // keep raw string
        }
        return trimmed;
    }

    if (typeof error === "object") {
        const candidate = error as { message?: unknown; error?: unknown };
        if (typeof candidate.message === "string" && candidate.message.trim()) {
            return candidate.message;
        }
        if (typeof candidate.error === "string" && candidate.error.trim()) {
            return candidate.error;
        }
        try {
            return JSON.stringify(error);
        } catch {
            return null;
        }
    }

    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_VARIATIONS = [
    "Scene: person looking directly at camera, upper body framing, natural moment between tasks. Maintain their EXACT natural facial expression from the reference photos — do not alter it.",
    "Scene: person working at laptop or reviewing documents at their desk, slightly angled, candid moment of focused work. Maintain their EXACT natural facial expression from the reference photos.",
    "Scene: person in mid-conversation or presenting — gesturing naturally or leaning forward, engaged posture, 3/4 body framing. Maintain their EXACT natural facial expression from the reference photos.",
    "Scene: person standing near a window or by their workspace, looking thoughtfully to the side, candid documentary-style framing. Maintain their EXACT natural facial expression from the reference photos.",
    "Scene: person walking through the office corridor with confident posture, documentary-style motion freeze, business editorial framing. Maintain their EXACT natural facial expression from the reference photos.",
];

const OUTFIT_PRIORITY_VARIATIONS = [
    "Scene: person looking directly at camera in their office, standing naturally. Use full-body framing from head to shoes so wardrobe and shoes are clearly visible. Maintain their EXACT natural facial expression from the reference photos — do not alter it.",
    "Scene: person working at laptop or reviewing documents at their desk, slightly angled. Use wide composition that includes full outfit and visible shoes under/near the desk whenever physically possible. Maintain their EXACT natural facial expression from the reference photos.",
    "Scene: person in mid-conversation or presenting — gesturing naturally or leaning forward, engaged posture. Use at least 7/8 body framing (prefer full body) so clothing and shoes are visible. Maintain their EXACT natural facial expression from the reference photos.",
    "Scene: person standing near a window or by their workspace, looking thoughtfully to the side, candid documentary-style framing. Use full-body framing from head to shoes. Maintain their EXACT natural facial expression from the reference photos.",
    "Scene: person walking through the office corridor with confident posture, documentary-style motion freeze, business editorial framing. Keep the entire silhouette in frame and show shoes clearly. Maintain their EXACT natural facial expression from the reference photos.",
];

function normalizeRequestedCount(value: number | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 4;
    return Math.min(5, Math.max(1, Math.round(value)));
}

function shouldPrioritizeOutfit(customPrompt: string, outfitCount: number): boolean {
    const normalized = customPrompt.toLowerCase();
    const closeFramingRequested = [
        "close-up",
        "close up",
        "headshot",
        "portrait",
        "portret",
        "zbliżenie",
        "zblizenie",
        "do pasa",
        "bust shot",
        "tight frame",
    ].some((keyword) => normalized.includes(keyword));

    if (closeFramingRequested) {
        return false;
    }

    return [
        "ubiór",
        "ubran",
        "styliz",
        "but",
        "shoes",
        "outfit",
        "full body",
        "pelna sylwetka",
        "cała postać",
        "cala postac",
    ].some((keyword) => normalized.includes(keyword)) || outfitCount > 0;
}

function buildWorkflowInstanceId(sessionId: string, runId: string): string {
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${safeSessionId}-${safeRunId}-${crypto.randomUUID()}`;
}

// ─── Cloudflare Workflow ──────────────────────────────────────────────────────

export class GenerationWorkflow extends WorkflowEntrypoint<Env, GenerateParams> {
    async run(event: WorkflowEvent<GenerateParams>, step: WorkflowStep) {
        const {
            sessionId,
            faceKeys,
            officeKeys,
            outfitKeys = [],
            customPrompt = "",
            requestedCount,
            runId,
            workflowInstanceId = "",
        } = event.payload;
        const safeRequestedCount = normalizeRequestedCount(requestedCount);
        const safeRunId = runId?.trim() || Date.now().toString();
        const prioritizeOutfit = shouldPrioritizeOutfit(customPrompt, outfitKeys.length);

        // Step 1: Generate a tailored prompt using Azure OpenAI
        const prompt = await step.do("generate-prompt", {
            retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
        }, async () => {
            return await generatePromptWithAzure(
                this.env,
                faceKeys.length,
                officeKeys.length,
                outfitKeys.length,
                customPrompt,
                prioritizeOutfit
            );
        });

        const workerUrl = WORKER_URL;
        const resultKeys: string[] = [];

        // Generate requested number of variations (1-5)
        const variationPool = prioritizeOutfit
            ? OUTFIT_PRIORITY_VARIATIONS
            : DEFAULT_VARIATIONS;
        const variations = variationPool.slice(0, safeRequestedCount);
        const imagePrompts = variations.map((variation, index) => ({
            index: index + 1,
            variation,
            finalPrompt: buildFinalImagePrompt(prompt, customPrompt, variation, prioritizeOutfit),
        }));

        const promptDebug: PromptDebugPayload = {
            runId: safeRunId,
            workflowInstanceId,
            stylePrompt: prompt,
            customPrompt: customPrompt.trim(),
            prioritizeOutfit,
            imagePrompts,
            createdAtIso: new Date().toISOString(),
        };

        console.log(`[Workflow] Prompt debug for session ${sessionId}, run ${safeRunId}: ${JSON.stringify(promptDebug)}`);

        for (let i = 0; i < imagePrompts.length; i++) {
            const { variation, finalPrompt } = imagePrompts[i];
            try {
                const key = await step.do(`generate-variation-${i + 1}`, {
                    retries: { limit: 2, delay: "10 seconds", backoff: "linear" },
                }, async () => {
                    // Fetch reference images fresh from R2 in each step
                    const [faceImages, officeImages, outfitImages] = await Promise.all([
                        fetchImagesFromR2(this.env, faceKeys.slice(0, 4)),
                        fetchImagesFromR2(this.env, officeKeys.slice(0, 2)),
                        outfitKeys.length
                            ? fetchImagesFromR2(this.env, outfitKeys.slice(0, 6))
                            : Promise.resolve<{ base64: string; mimeType: string }[]>([]),
                    ]);

                    // Generate one image with Gemini
                    const base64Image = await generateOneImage(
                        this.env,
                        finalPrompt,
                        variation,
                        faceImages,
                        officeImages,
                        outfitImages
                    );

                    // Save immediately to R2 — return only the key (small string)
                    const resultKey = `results/${sessionId}/${safeRunId}/photo-${i + 1}.jpg`;
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
            } catch (error) {
                console.error(
                    `[Workflow] Variation ${i + 1} failed (${variation}): ${getReadableError(error) || "unknown error"}`
                );
            }
        }

        if (resultKeys.length === 0) {
            throw new Error(
                "Nie udało się wygenerować żadnego zdjęcia w tej próbie. Spróbuj zmienić prompt lub materiały i uruchomić sesję ponownie."
            );
        }

        // Build result URLs (served via Worker's /file endpoint)
        const resultUrls = resultKeys.map(k => `${workerUrl}/file?key=${encodeURIComponent(k)}`);

        return { resultUrls, sessionId, promptDebug };
    }
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

const workerHandler = {
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

        // Delete files from R2 binding
        if (url.pathname === "/delete") {
            if (request.method !== "POST") {
                return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
            }
            return handleDeleteFile(request, env);
        }

        // Serve files from R2 binding
        if (url.pathname === "/file") {
            const key = url.searchParams.get("key");
            const shouldDownload = url.searchParams.get("download") === "1";
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
            const filename = key.split("/").pop() || "image.jpg";
            return new Response(object.body, {
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=86400",
                    ...(shouldDownload ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
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
                const {
                    sessionId,
                    uid,
                    faceKeys,
                    officeKeys,
                    outfitKeys = [],
                    customPrompt = "",
                    requestedCount,
                    runId,
                } = body;
                const normalizedCustomPrompt =
                    typeof customPrompt === "string" ? customPrompt.trim() : "";
                const normalizedRunId =
                    typeof runId === "string" && runId.trim().length > 0
                        ? runId.trim()
                        : Date.now().toString();
                const workflowInstanceId = buildWorkflowInstanceId(sessionId, normalizedRunId);

                if (
                    !sessionId ||
                    !uid ||
                    !faceKeys?.length ||
                    !officeKeys?.length ||
                    !Array.isArray(faceKeys) ||
                    !Array.isArray(officeKeys) ||
                    !Array.isArray(outfitKeys)
                ) {
                    return new Response(JSON.stringify({ error: "Missing required fields" }), {
                        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                    });
                }

                // Create workflow instance — runs in background
                const instance = await env.GENERATION_WORKFLOW.create({
                    id: workflowInstanceId,
                    params: {
                        sessionId,
                        uid,
                        faceKeys,
                        officeKeys,
                        outfitKeys,
                        customPrompt: normalizedCustomPrompt,
                        requestedCount: normalizeRequestedCount(requestedCount),
                        runId: normalizedRunId,
                        workflowInstanceId,
                    },
                });

                return new Response(JSON.stringify({ instanceId: instance.id, status: "queued" }), {
                    status: 202, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            } catch (error: unknown) {
                return new Response(JSON.stringify({ error: getErrorMessage(error, "Failed to start generation workflow") }), {
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
                const body = await request.json() as { prompt?: string; referenceKeys?: string[] };
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

                const parts: GeminiPart[] = [{ text: finalPrompt }];
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

                let base64Image: string | null = null;
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
            } catch (error: unknown) {
                console.error("Custom generation error:", error);
                return new Response(JSON.stringify({ error: getErrorMessage(error, "Custom generation failed") }), {
                    status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
        }

        // Poll workflow status
        if (url.pathname === "/status") {
            const instanceId = url.searchParams.get("instanceId");
            const runId = url.searchParams.get("runId");
            const sessionId = url.searchParams.get("sessionId");
            if (!instanceId) {
                return new Response(JSON.stringify({ error: "Missing instanceId" }), {
                    status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
            try {
                const instance = await env.GENERATION_WORKFLOW.get(instanceId);
                const status = await instance.status();
                const statusOutput = status.output as { resultUrls?: string[]; promptDebug?: PromptDebugPayload } | undefined;
                const workflowResultUrls = statusOutput?.resultUrls ?? [];

                let discoveredUrls: string[] = [];
                if (status.status !== "complete" || workflowResultUrls.length === 0) {
                    const baseId = sessionId || instanceId;
                    const prefix = runId ? `results/${baseId}/${runId}/` : `results/${baseId}/`;
                    const list = await env.MEDIA_BUCKET.list({ prefix });
                    discoveredUrls = list.objects
                        .sort((a, b) => a.key.localeCompare(b.key))
                        .map((o) => `${WORKER_URL}/file?key=${encodeURIComponent(o.key)}`);
                }

                const finalResultUrls =
                    workflowResultUrls.length > 0 ? workflowResultUrls : discoveredUrls;
                const finalOutput = statusOutput
                    ? { ...statusOutput, resultUrls: finalResultUrls }
                    : { resultUrls: finalResultUrls };

                return new Response(JSON.stringify({
                    status: status.status,
                    output: finalOutput,
                    error: getReadableError(status.error),
                }), {
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            } catch (error: unknown) {
                return new Response(JSON.stringify({ error: getErrorMessage(error, "Status not found") }), {
                    status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
                });
            }
        }

        return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    },
};
export default workerHandler;

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
    } catch (error: unknown) {
        return new Response(JSON.stringify({ error: getErrorMessage(error, "Upload failed") }), {
            status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    }
}

async function handleDeleteFile(request: Request, env: Env): Promise<Response> {
    try {
        const body = await request.json() as { key?: string };
        const key = typeof body.key === "string" ? body.key.trim() : "";

        if (!key) {
            return new Response(JSON.stringify({ error: "Missing key" }), {
                status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        // Only allow deleting uploaded user assets.
        if (!key.startsWith("uploads/")) {
            return new Response(JSON.stringify({ error: "Invalid key prefix" }), {
                status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
        }

        await env.MEDIA_BUCKET.delete(key);

        return new Response(JSON.stringify({ success: true, key }), {
            status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
    } catch (error: unknown) {
        return new Response(JSON.stringify({ error: getErrorMessage(error, "Delete failed") }), {
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

async function generatePromptWithAzure(
    env: Env,
    faceCount: number,
    officeCount: number,
    outfitCount: number,
    customPrompt: string,
    prioritizeOutfit: boolean
): Promise<string> {
    const systemPrompt = `You are a professional photography prompt engineer specializing in corporate business photo sessions.
Create a prompt for a high-end business photo session — NOT a passport or ID headshot.`;

    const customPromptText = customPrompt.trim();
    const userMessage = `I have ${faceCount} face reference photo(s), ${officeCount} office/workspace reference photo(s), and ${outfitCount} outfit reference photo(s).

Generate a photorealistic corporate photo prompt (2-3 sentences) with these requirements:
- Preserve EXACT identity: face structure, skin tone, hair, and natural expression from references
- Keep the exact office/workspace environment from office references
- Use realistic premium business photography style: natural window light + soft studio fill, 85mm lens, f/2.0
- The result must be suitable for LinkedIn, press materials, and company websites
${prioritizeOutfit
        ? "- Prioritize outfit visibility with wider framing (head-to-shoes when physically possible)"
        : "- Keep framing natural to the scene; do NOT force full-body framing when it is not requested"}
${customPromptText
        ? `- USER PRIORITY (highest priority creative direction): ${customPromptText}
- If USER PRIORITY specifies pose/framing/styling, follow it unless it conflicts with identity or office consistency`
        : "- No additional user prompt was provided: choose a natural, professional composition"}

Return ONLY the final image prompt text.`;

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
        return getDefaultPrompt(customPromptText, prioritizeOutfit);
    }

    const data = await resp.json() as AzureChatCompletionResponse;
    return data.choices?.[0]?.message?.content || getDefaultPrompt(customPromptText, prioritizeOutfit);
}

function getDefaultPrompt(customPrompt: string, prioritizeOutfit: boolean): string {
    const trimmedCustomPrompt = customPrompt.trim();
    const framingLine = prioritizeOutfit
        ? "Prioritize wider composition so outfit and shoes are visible whenever physically possible."
        : "Keep composition natural to the scene and avoid forcing full-body framing unless explicitly requested.";
    const customLine = trimmedCustomPrompt
        ? `Primary user direction (highest priority): ${trimmedCustomPrompt}.`
        : "No extra user direction was provided; choose a clean, natural business composition.";

    return `Photorealistic professional business photo session. Preserve the person's exact face, skin tone, hair, clothing, and natural expression from the reference photos. Place them in the exact office environment shown in workspace references. ${framingLine} Natural window light with soft studio fill, 85mm f/2.0, warm professional color grading. ${customLine}`.trim();
}

// ─── Generate one image with Gemini ──────────────────────────────────────────

function buildFinalImagePrompt(
    prompt: string,
    customPrompt: string,
    variation: string,
    prioritizeOutfit: boolean
): string {
    const trimmedCustomPrompt = customPrompt.trim();
    const customPromptBlock = trimmedCustomPrompt
        ? `\n\nPRIORITY USER PROMPT (HIGHEST PRIORITY): ${trimmedCustomPrompt}\nWhen this prompt specifies pose/framing/styling, follow it over generic guidance unless it conflicts with identity or office consistency.`
        : "";
    const framingRule = prioritizeOutfit
        ? "Prioritize wider framing so outfit and shoes stay visible whenever physically possible."
        : "Respect requested framing in variation/user prompt and avoid forcing full-body framing when not requested.";

    return `PHOTO SESSION STYLE: ${prompt}\n\nVARIATION INSTRUCTIONS: ${variation}${customPromptBlock}\n\nIMPORTANT: Do NOT invent or change the person's facial expression. Reproduce it exactly as it appears in reference photos. ${framingRule} The image must look like a real professional business photo session, not an illustration or passport photo.`;
}

async function generateOneImage(
    env: Env,
    finalImagePrompt: string,
    variation: string,
    faceImages: { base64: string; mimeType: string }[],
    officeImages: { base64: string; mimeType: string }[],
    outfitImages: { base64: string; mimeType: string }[]
): Promise<string> {  // throws on failure — workflow will retry
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const parts: GeminiPart[] = [];

    parts.push({
        text: `FACE REFERENCE PHOTOS (${faceImages.length} images):\nThese show the EXACT person to photograph. You MUST:\n- Preserve their face structure, skin tone, eye color, nose shape, jawline 100% accurately\n- Keep their hair color, length, and style EXACTLY as shown\n- Reproduce visible clothing/style cues as faithfully as possible`,
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

    if (outfitImages.length > 0) {
        parts.push({
            text: `OUTFIT REFERENCE PHOTOS (${outfitImages.length} images):\nUse these as wardrobe guidance. Prioritize similar clothing silhouette, color palette, fabrics, and styling details.`,
        });
        for (const img of outfitImages) {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        }
    }

    parts.push({
        text: finalImagePrompt,
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`[Gemini] Calling API for variation ${variation}, attempt ${attempt}/3`);

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

        if (attempt < 3) {
            await sleep(attempt * 800);
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
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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
