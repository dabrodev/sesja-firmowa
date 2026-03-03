export function withDownloadParam(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.searchParams.set("download", "1");
        return parsed.toString();
    } catch {
        return url;
    }
}

export async function downloadFile(url: string, filename: string): Promise<void> {
    const response = await fetch(withDownloadParam(url), { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
}

