import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { safeStorage } from "electron";
import FormData from "form-data";
import type { CreateShareResult, ProjectShare } from "../../../shared/types";
import { getEventById } from "../../infra/db/repositories/EventRepository";
import {
	deleteProjectShare,
	getProjectShare,
	insertProjectShare,
	updateProjectShareLastPublished,
	updateProjectShareUrl,
} from "../../infra/db/repositories/ProjectShareRepository";
import {
	getRoomKeyCache,
	upsertRoomKeyCache,
} from "../../infra/db/repositories/RoomKeysCacheRepository";
import { createLogger } from "../../infra/log";
import {
	decodeRoomKeyB64,
	encodeRoomKeyB64,
	encryptRoomEventPayload,
	encryptRoomImageBytes,
	generateRoomKey,
} from "../rooms/RoomCrypto";
import { getIdentity, signedFetch } from "../social/IdentityService";

const logger = createLogger({ scope: "PublishingService" });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_FILE_SIZE_BYTES = 45 * 1024 * 1024;

function getHqPath(webpPath: string): string | null {
	if (!webpPath.endsWith(".webp")) return null;
	return webpPath.replace(/\.webp$/, ".hq.png");
}

function getUploadablePath(originalPath: string | null): string | null {
	if (!originalPath) return null;
	if (!existsSync(originalPath)) return null;

	const hqPath = getHqPath(originalPath);
	if (hqPath && existsSync(hqPath)) {
		const hqStats = statSync(hqPath);
		if (hqStats.size <= MAX_FILE_SIZE_BYTES) {
			logger.debug("Using HQ image", { path: hqPath, size: hqStats.size });
			return hqPath;
		}
		logger.debug("HQ image too large, falling back to WebP", {
			hqPath,
			hqSize: hqStats.size,
			limit: MAX_FILE_SIZE_BYTES,
		});
	}

	const stats = statSync(originalPath);
	if (stats.size <= MAX_FILE_SIZE_BYTES) {
		return originalPath;
	}

	logger.debug("Image too large", { path: originalPath, size: stats.size });
	return null;
}

type StoredSecret = { scheme: "safeStorage" | "plain"; payload: string };

function decodeSecret(encoded: string): StoredSecret | null {
	try {
		const parsed = JSON.parse(encoded) as Partial<StoredSecret>;
		if (
			(parsed.scheme !== "safeStorage" && parsed.scheme !== "plain") ||
			typeof parsed.payload !== "string"
		) {
			return null;
		}
		return { scheme: parsed.scheme, payload: parsed.payload };
	} catch {
		return null;
	}
}

function decryptSecret(secret: StoredSecret): string | null {
	try {
		if (secret.scheme === "plain") return secret.payload;
		return safeStorage.decryptString(Buffer.from(secret.payload, "base64"));
	} catch {
		return null;
	}
}

function decodeBase64UrlToBase64(b64url: string): string {
	const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
	const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
	return `${b64}${pad}`;
}

function encodeBase64ToBase64Url(b64: string): string {
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeRoomKeyForCache(roomKeyB64: string): string {
	return JSON.stringify({
		scheme: safeStorage.isEncryptionAvailable() ? "safeStorage" : "plain",
		payload: safeStorage.isEncryptionAvailable()
			? safeStorage.encryptString(roomKeyB64).toString("base64")
			: roomKeyB64,
	});
}

function getRoomKeyForShare(share: ProjectShare): Buffer | null {
	const cached = getRoomKeyCache(share.publicId);
	if (cached) {
		const secret = decodeSecret(cached.roomKeyEnc);
		const decrypted = secret ? decryptSecret(secret) : null;
		if (decrypted) return decodeRoomKeyB64(decrypted);
	}

	let url: URL;
	try {
		url = new URL(share.shareUrl);
	} catch {
		return null;
	}

	const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
	const params = new URLSearchParams(hash);
	const k = params.get("k");
	if (!k) return null;

	try {
		const roomKeyB64 = decodeBase64UrlToBase64(k);
		const roomKey = decodeRoomKeyB64(roomKeyB64);
		const roomKeyEnc = JSON.stringify({
			scheme: safeStorage.isEncryptionAvailable() ? "safeStorage" : "plain",
			payload: safeStorage.isEncryptionAvailable()
				? safeStorage.encryptString(roomKeyB64).toString("base64")
				: roomKeyB64,
		});
		upsertRoomKeyCache({
			roomId: share.publicId,
			roomKeyEnc,
			updatedAt: Date.now(),
		});
		return roomKey;
	} catch {
		return null;
	}
}

function ensureRoomKeyForShare(
	share: ProjectShare,
): { roomKey: Buffer; shareUrl: string } | null {
	const existing = getRoomKeyForShare(share);
	if (existing) return { roomKey: existing, shareUrl: share.shareUrl };

	let url: URL;
	try {
		url = new URL(share.shareUrl);
	} catch {
		return null;
	}

	const roomKey = generateRoomKey();
	const roomKeyB64 = encodeRoomKeyB64(roomKey);
	const roomKeyEnc = encodeRoomKeyForCache(roomKeyB64);
	upsertRoomKeyCache({
		roomId: share.publicId,
		roomKeyEnc,
		updatedAt: Date.now(),
	});

	url.hash = `k=${encodeBase64ToBase64Url(roomKeyB64)}`;
	const shareUrl = url.toString();
	updateProjectShareUrl(share.projectName, shareUrl);

	return { roomKey, shareUrl };
}

export async function createShare(
	projectName: string,
): Promise<CreateShareResult> {
	const existing = getProjectShare(projectName);
	if (existing) {
		return {
			publicId: existing.publicId,
			writeKey: existing.writeKey,
			shareUrl: existing.shareUrl,
		};
	}

	if (!getIdentity()) {
		throw new Error("Register a username in the tray popup to enable sharing");
	}

	const response = await signedFetch("/api/published-projects", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: projectName }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to create share: ${response.status} ${text}`);
	}

	const result = (await response.json()) as CreateShareResult;

	const roomKey = generateRoomKey();
	const roomKeyB64 = encodeRoomKeyB64(roomKey);
	const roomKeyEnc = encodeRoomKeyForCache(roomKeyB64);
	upsertRoomKeyCache({
		roomId: result.publicId,
		roomKeyEnc,
		updatedAt: Date.now(),
	});

	const keyB64Url = encodeBase64ToBase64Url(roomKeyB64);
	const shareUrl = `${result.shareUrl}#k=${keyB64Url}`;

	const share: ProjectShare = {
		projectName,
		publicId: result.publicId,
		writeKey: result.writeKey,
		shareUrl,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		lastPublishedAt: null,
	};

	insertProjectShare(share);
	logger.info("Created share", { projectName, publicId: result.publicId });

	return { ...result, shareUrl };
}

export function getShare(projectName: string): ProjectShare | null {
	return getProjectShare(projectName);
}

export function disableShare(projectName: string): void {
	deleteProjectShare(projectName);
	logger.info("Disabled share", { projectName });
}

export async function publishEvent(eventId: string): Promise<void> {
	const event = getEventById(eventId);
	if (!event) {
		logger.warn("Event not found for publishing", { eventId });
		return;
	}

	if (!event.project) {
		logger.debug("Event has no project, skipping publish", { eventId });
		return;
	}

	const share = getProjectShare(event.project);
	if (!share) {
		logger.debug("Project has no share enabled", {
			eventId,
			project: event.project,
		});
		return;
	}

	const imagePath = getUploadablePath(event.originalPath);
	if (!imagePath) {
		logger.warn("Event image not found or too large", {
			eventId,
			originalPath: event.originalPath,
		});
		return;
	}

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			await uploadEvent({
				share,
				eventId,
				timestampMs: event.timestamp,
				caption: event.caption,
				imagePath,
			});

			updateProjectShareLastPublished(event.project, Date.now());
			logger.info("Published event", {
				eventId,
				project: event.project,
				attempt,
			});
			return;
		} catch (error) {
			logger.warn("Publish attempt failed", {
				eventId,
				attempt,
				error: String(error),
			});

			if (attempt < MAX_RETRIES) {
				await sleep(RETRY_DELAY_MS * attempt);
			}
		}
	}

	logger.error("Failed to publish event after retries", { eventId });
}

async function uploadEvent(params: {
	share: ProjectShare;
	eventId: string;
	timestampMs: number;
	caption: string | null;
	imagePath: string;
}): Promise<void> {
	const { share, eventId, timestampMs, caption, imagePath } = params;

	const ext = extname(imagePath).slice(1) || "webp";
	const mimeType =
		ext === "png"
			? "image/png"
			: ext === "jpg" || ext === "jpeg"
				? "image/jpeg"
				: "image/webp";

	const imageBuffer = readFileSync(imagePath);
	const ensured = ensureRoomKeyForShare(share);
	if (!ensured) {
		throw new Error("Missing room key for share");
	}

	const formData = new FormData();
	formData.append("eventId", eventId);
	formData.append("timestampMs", String(timestampMs));
	const payloadCiphertext = encryptRoomEventPayload({
		roomKey: ensured.roomKey,
		payloadJsonUtf8: Buffer.from(
			JSON.stringify({ v: 1, caption, image: { mime: mimeType } }),
			"utf8",
		),
	});
	const encryptedImage = encryptRoomImageBytes({
		roomKey: ensured.roomKey,
		plaintextBytes: imageBuffer,
	});
	formData.append("payloadCiphertext", payloadCiphertext);
	formData.append("file", encryptedImage, {
		filename: `${eventId}.${ext}`,
		contentType: "application/octet-stream",
	});

	const body = formData.getBuffer();
	const response = await signedFetch(
		`/api/published-projects/${share.publicId}/events`,
		{
			method: "POST",
			headers: {
				...formData.getHeaders(),
				"Content-Length": String(body.byteLength),
				"x-write-key": share.writeKey,
			},
			body,
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Upload failed: ${response.status} ${text}`);
	}
}

export async function backfillEvents(
	projectName: string,
	limit: number = 50,
): Promise<number> {
	const share = getProjectShare(projectName);
	if (!share) return 0;

	const { getEvents } = await import(
		"../../infra/db/repositories/EventRepository"
	);

	const events = getEvents({
		project: projectName,
		projectProgress: true,
		dismissed: false,
		limit,
	});

	let published = 0;
	for (const event of events) {
		try {
			await publishEvent(event.id);
			published++;
		} catch (error) {
			logger.warn("Backfill event failed", {
				eventId: event.id,
				error: String(error),
			});
		}
	}

	logger.info("Backfill complete", {
		projectName,
		published,
		total: events.length,
	});
	return published;
}
