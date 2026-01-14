import { existsSync, readFileSync } from "node:fs";

export interface McpImageContent {
	type: "image";
	data: string;
	mimeType: string;
}

export function getImageBase64(imagePath: string | null): string | null {
	if (!imagePath || !existsSync(imagePath)) {
		return null;
	}

	try {
		const buffer = readFileSync(imagePath);
		return buffer.toString("base64");
	} catch {
		return null;
	}
}

export function getMimeType(path: string | null): string {
	if (!path) return "image/png";
	if (path.endsWith(".webp")) return "image/webp";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	return "image/png";
}

export function getEventImage(
	originalPath: string | null,
	thumbnailPath: string | null,
): { base64: string; mimeType: string } | null {
	const path = originalPath || thumbnailPath;
	const base64 = getImageBase64(path);
	if (!base64) return null;
	return { base64, mimeType: getMimeType(path) };
}

export function formatImageContent(
	base64: string,
	mimeType: string,
): McpImageContent {
	return {
		type: "image",
		data: base64,
		mimeType,
	};
}
