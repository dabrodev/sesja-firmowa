export const DEFAULT_REQUESTED_COUNT = 4;
export const REQUESTED_COUNT_OPTIONS = [2, 4, 6, 8, 10] as const;
const MIN_REQUESTED_COUNT = 1;
const MAX_REQUESTED_COUNT = 10;

export function normalizeRequestedCount(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_REQUESTED_COUNT;
    }

    return Math.min(MAX_REQUESTED_COUNT, Math.max(MIN_REQUESTED_COUNT, Math.round(value)));
}

export function getRequestedCountOptions(currentValue?: number): number[] {
    if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) {
        return [...REQUESTED_COUNT_OPTIONS];
    }

    const normalizedCurrentValue = normalizeRequestedCount(currentValue);
    const values = new Set<number>(REQUESTED_COUNT_OPTIONS);
    values.add(normalizedCurrentValue);

    return Array.from(values).sort((a, b) => a - b);
}

export function formatPhotoCountLabel(count: number): string {
    const normalizedCount = Math.max(0, Math.round(count));
    const mod10 = normalizedCount % 10;
    const mod100 = normalizedCount % 100;

    if (normalizedCount === 1) {
        return "1 zdjęcie";
    }

    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        return `${normalizedCount} zdjęcia`;
    }

    return `${normalizedCount} zdjęć`;
}
