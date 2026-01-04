import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { getEventById } from "../../infra/db/repositories/EventRepository";
import { getRoomIdForProject } from "../../infra/db/repositories/ProjectRoomLinkRepository";
import { createLogger } from "../../infra/log";
import {
	decryptRoomEventPayload,
	encryptRoomEventPayload,
	encryptRoomImageBytes,
} from "../rooms/RoomCrypto";
import { getRoomKey } from "../rooms/RoomsService";
import { signedFetch } from "../social/IdentityService";

const logger = createLogger({ scope: "RoomSyncService" });

const MAX_FILE_SIZE_BYTES = 45 * 1024 * 1024;

function mimeTypeForPath(path: string): string {
	const ext = extname(path).slice(1).toLowerCase();
	if (ext === "png") return "image/png";
	if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
	return "image/webp";
}

function getUploadablePath(originalPath: string | null): string | null {
	if (!originalPath) return null;
	if (!existsSync(originalPath)) return null;
	try {
		const bytes = readFileSync(originalPath);
		if (bytes.byteLength > MAX_FILE_SIZE_BYTES) return null;
		return originalPath;
	} catch {
		return null;
	}
}

function buildPayloadJson(params: {
	caption: string | null;
	imageRef: string | null;
	mime: string;
}): Uint8Array {
	return Buffer.from(
		JSON.stringify({
			v: 1,
			caption: params.caption,
			image: { ref: params.imageRef, mime: params.mime },
		}),
		"utf8",
	);
}

export async function publishProgressEventToRoom(
	eventId: string,
): Promise<void> {
	const event = getEventById(eventId);
	if (!event) return;
	if (!event.project) return;

	const roomId = getRoomIdForProject(event.project);
	if (!roomId) return;

	const roomKey = await getRoomKey(roomId);

	const imagePath = getUploadablePath(event.originalPath);
	if (!imagePath) {
		logger.warn("Event image missing or too large", { eventId });
		return;
	}
	const mime = mimeTypeForPath(imagePath);

	const payload0 = encryptRoomEventPayload({
		roomKey,
		payloadJsonUtf8: buildPayloadJson({
			caption: event.caption,
			imageRef: null,
			mime,
		}),
	});

	const createRes = await signedFetch(`/api/rooms/${roomId}/events`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			eventId,
			timestampMs: event.timestamp,
			payloadCiphertext: payload0,
		}),
	});

	if (!createRes.ok) {
		const text = await createRes.text();
		throw new Error(`room event create failed: ${createRes.status} ${text}`);
	}

	const plaintextImage = readFileSync(imagePath);
	const encryptedImage = encryptRoomImageBytes({
		roomKey,
		plaintextBytes: plaintextImage,
	});

	const imageRes = await signedFetch(
		`/api/rooms/${roomId}/events/${eventId}/image`,
		{
			method: "POST",
			headers: { "Content-Type": "application/octet-stream" },
			body: encryptedImage,
		},
	);

	if (!imageRes.ok) {
		const text = await imageRes.text();
		throw new Error(`room image upload failed: ${imageRes.status} ${text}`);
	}

	const { imageRef } = (await imageRes.json()) as { imageRef: string };
	const payload1 = encryptRoomEventPayload({
		roomKey,
		payloadJsonUtf8: buildPayloadJson({
			caption: event.caption,
			imageRef,
			mime,
		}),
	});

	const updateRes = await signedFetch(`/api/rooms/${roomId}/events`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			eventId,
			timestampMs: event.timestamp,
			payloadCiphertext: payload1,
		}),
	});

	if (!updateRes.ok) {
		const text = await updateRes.text();
		throw new Error(`room event update failed: ${updateRes.status} ${text}`);
	}

	logger.info("Published room event", { eventId, roomId });
}

export type DecryptedRoomEvent = {
	id: string;
	roomId: string;
	authorUserId: string;
	timestampMs: number;
	caption: string | null;
	imageRef: string | null;
};

export async function fetchRoomEvents(params: {
	roomId: string;
	since?: number;
	before?: number;
	limit?: number;
}): Promise<DecryptedRoomEvent[]> {
	const roomKey = await getRoomKey(params.roomId);

	const qp = new URLSearchParams();
	if (params.since !== undefined) qp.set("since", String(params.since));
	if (params.before !== undefined) qp.set("before", String(params.before));
	if (params.limit !== undefined) qp.set("limit", String(params.limit));

	const url =
		qp.size > 0
			? `/api/rooms/${params.roomId}/events?${qp}`
			: `/api/rooms/${params.roomId}/events`;
	const res = await signedFetch(url, { method: "GET" });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`fetchRoomEvents failed: ${res.status} ${text}`);
	}

	const events = (await res.json()) as Array<{
		id: string;
		roomId: string;
		authorUserId: string;
		timestampMs: number;
		payloadCiphertext: string;
		imageRef: string | null;
	}>;

	return events.map((e) => {
		const payloadBytes = decryptRoomEventPayload({
			roomKey,
			payloadCiphertextB64: e.payloadCiphertext,
		});
		const payload = JSON.parse(payloadBytes.toString("utf8")) as {
			caption?: string | null;
			image?: { ref?: string | null };
		};
		const imageRef =
			typeof payload?.image?.ref === "string" ? payload.image.ref : e.imageRef;
		return {
			id: e.id,
			roomId: e.roomId,
			authorUserId: e.authorUserId,
			timestampMs: e.timestampMs,
			caption: typeof payload?.caption === "string" ? payload.caption : null,
			imageRef: imageRef ?? null,
		};
	});
}
