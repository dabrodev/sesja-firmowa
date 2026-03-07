type WorkerErrorInfo = {
    message: string;
    code?: number;
    status?: string;
};

function normalizeCode(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value);
    }
    if (typeof value === "string") {
        const match = value.match(/\b(\d{3})\b/);
        if (match) {
            const parsed = Number.parseInt(match[1], 10);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return undefined;
}

function collectWorkerErrorInfo(value: unknown, bag: { messages: string[]; code?: number; status?: string }) {
    if (!value) return;

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return;

        const maybeCode = normalizeCode(trimmed);
        if (maybeCode && !bag.code) {
            bag.code = maybeCode;
        }

        try {
            collectWorkerErrorInfo(JSON.parse(trimmed), bag);
            return;
        } catch {
            bag.messages.push(trimmed);
            return;
        }
    }

    if (typeof value === "number") {
        if (!bag.code) {
            bag.code = normalizeCode(value);
        }
        return;
    }

    if (typeof value !== "object") return;

    const candidate = value as Record<string, unknown>;
    const code = normalizeCode(candidate.code);
    if (code && !bag.code) {
        bag.code = code;
    }

    if (typeof candidate.status === "string" && candidate.status.trim() && !bag.status) {
        bag.status = candidate.status.trim();
    }

    if ("error" in candidate) {
        collectWorkerErrorInfo(candidate.error, bag);
    }
    if ("message" in candidate) {
        collectWorkerErrorInfo(candidate.message, bag);
    }
}

export function parseWorkerError(raw: string, fallback: string): WorkerErrorInfo {
    const bag: { messages: string[]; code?: number; status?: string } = { messages: [] };
    collectWorkerErrorInfo(raw, bag);

    const message = bag.messages.find((entry) => entry.length > 0) ?? fallback;

    return {
        message,
        code: bag.code,
        status: bag.status,
    };
}

export function toUserFacingWorkerError(raw: string, fallback: string, httpStatus?: number): string {
    const parsed = parseWorkerError(raw, fallback);
    const code = parsed.code ?? httpStatus;
    const message = parsed.message.toLowerCase();
    const status = parsed.status?.toUpperCase() ?? "";

    if (
        code === 503 ||
        status === "UNAVAILABLE" ||
        message.includes("high demand") ||
        message.includes("currently experiencing high demand")
    ) {
        return "Model jest chwilowo przeciążony. Spróbuj ponownie za chwilę.";
    }

    if (code === 524 || message.includes("error code: 524")) {
        return "Generowanie przekroczyło limit czasu po stronie dostawcy obrazu. Spróbuj ponownie za chwilę.";
    }

    if (code === 429) {
        return "Usługa odrzuciła próbę z powodu limitu zapytań. Spróbuj ponownie za chwilę.";
    }

    if (parsed.message.startsWith("{") && parsed.message.endsWith("}")) {
        return fallback;
    }

    return parsed.message || fallback;
}
