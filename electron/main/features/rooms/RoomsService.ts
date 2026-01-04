import { safeStorage } from "electron";
import type { RoomInvite } from "../../../shared/types";
import {
	getRoomIdForProject,
	upsertProjectRoomLink,
} from "../../infra/db/repositories/ProjectRoomLinkRepository";
import {
	getRoomKeyCache,
	upsertRoomKeyCache,
} from "../../infra/db/repositories/RoomKeysCacheRepository";
import { createLogger } from "../../infra/log";
import {
	getDhPrivateKeyPkcs8DerB64,
	signedFetch,
} from "../social/IdentityService";
import {
	createRoomKeyEnvelope,
	decodeRoomKeyB64,
	encodeRoomKeyB64,
	generateRoomKey,
	openRoomKeyEnvelope,
} from "./RoomCrypto";

const logger = createLogger({ scope: "RoomsService" });

type StoredSecret = { scheme: "safeStorage" | "plain"; payload: string };

function encryptSecret(value: string): StoredSecret {
	if (!safeStorage.isEncryptionAvailable()) {
		return { scheme: "plain", payload: value };
	}
	return {
		scheme: "safeStorage",
		payload: safeStorage.encryptString(value).toString("base64"),
	};
}

function decryptSecret(secret: StoredSecret): string | null {
	try {
		if (secret.scheme === "plain") return secret.payload;
		return safeStorage.decryptString(Buffer.from(secret.payload, "base64"));
	} catch {
		return null;
	}
}

function encodeSecretJson(secret: StoredSecret): string {
	return JSON.stringify(secret);
}

function decodeSecretJson(encoded: string): StoredSecret | null {
	try {
		const parsed = JSON.parse(encoded) as Partial<StoredSecret>;
		if (
			(parsed.scheme !== "plain" && parsed.scheme !== "safeStorage") ||
			typeof parsed.payload !== "string"
		) {
			return null;
		}
		return { scheme: parsed.scheme, payload: parsed.payload };
	} catch {
		return null;
	}
}

async function createRoomOnServer(params: {
	name: string;
	visibility: "private" | "public";
}): Promise<{ roomId: string }> {
	const res = await signedFetch("/api/rooms", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			kind: "project",
			name: params.name,
			visibility: params.visibility,
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`createRoom failed: ${res.status} ${text}`);
	}
	const room = (await res.json()) as { id: string };
	return { roomId: room.id };
}

export async function ensureRoomForProject(params: {
	projectName: string;
	visibility?: "private" | "public";
}): Promise<string> {
	const existing = getRoomIdForProject(params.projectName);
	if (existing) return existing;

	const roomKey = generateRoomKey();
	const { roomId } = await createRoomOnServer({
		name: params.projectName,
		visibility: params.visibility ?? "private",
	});

	upsertProjectRoomLink({
		projectName: params.projectName,
		roomId,
		createdAt: Date.now(),
	});

	const roomKeyB64 = encodeRoomKeyB64(roomKey);
	const roomKeyEnc = encodeSecretJson(encryptSecret(roomKeyB64));
	upsertRoomKeyCache({ roomId, roomKeyEnc, updatedAt: Date.now() });

	logger.info("Created room for project", {
		projectName: params.projectName,
		roomId,
	});
	return roomId;
}

export async function getRoomKey(roomId: string): Promise<Buffer> {
	const cached = getRoomKeyCache(roomId);
	if (cached) {
		const secret = decodeSecretJson(cached.roomKeyEnc);
		const decrypted = secret ? decryptSecret(secret) : null;
		if (decrypted) {
			return decodeRoomKeyB64(decrypted);
		}
	}

	const res = await signedFetch(`/api/rooms/${roomId}/keys`, { method: "GET" });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`getRoomKey failed: ${res.status} ${text}`);
	}
	const { envelopeJson } = (await res.json()) as { envelopeJson: string };
	const roomKey = openRoomKeyEnvelope({
		envelopeJson,
		recipientDhPrivKeyPkcs8DerB64: getDhPrivateKeyPkcs8DerB64(),
	});

	const roomKeyB64 = encodeRoomKeyB64(roomKey);
	const roomKeyEnc = encodeSecretJson(encryptSecret(roomKeyB64));
	upsertRoomKeyCache({ roomId, roomKeyEnc, updatedAt: Date.now() });

	return roomKey;
}

export async function inviteFriendToProjectRoom(params: {
	projectName: string;
	friendUserId: string;
}): Promise<void> {
	const roomId = await ensureRoomForProject({
		projectName: params.projectName,
	});
	const roomKey = await getRoomKey(roomId);

	const inviteRes = await signedFetch(`/api/rooms/${roomId}/invites`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ toUserId: params.friendUserId }),
	});

	if (!inviteRes.ok) {
		const text = await inviteRes.text();
		throw new Error(`inviteFriend failed: ${inviteRes.status} ${text}`);
	}

	const invite = (await inviteRes.json()) as {
		inviteId: string;
		devices: Array<{ deviceId: string; dhPubKey: string }>;
	};

	if (!invite.devices || invite.devices.length === 0) {
		throw new Error("Invitee has no registered devices");
	}

	const envelopes = invite.devices.map((d) => ({
		deviceId: d.deviceId,
		envelopeJson: JSON.stringify(
			createRoomKeyEnvelope({
				roomKey,
				recipientDhPubKeySpkiDerB64: d.dhPubKey,
			}),
		),
	}));

	const keyRes = await signedFetch(`/api/rooms/${roomId}/keys`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ envelopes }),
	});

	if (!keyRes.ok) {
		const text = await keyRes.text();
		throw new Error(`upload envelopes failed: ${keyRes.status} ${text}`);
	}

	logger.info("Invited friend to room", {
		projectName: params.projectName,
		roomId,
		inviteId: invite.inviteId,
	});
}

export type Room = {
	id: string;
	kind: "project";
	name: string;
	visibility: "private" | "public";
	role: "owner" | "member";
	createdBy: string;
	createdAt: number;
};

export async function listRooms(): Promise<Room[]> {
	const res = await signedFetch("/api/rooms", { method: "GET" });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`listRooms failed: ${res.status} ${text}`);
	}
	return (await res.json()) as Room[];
}

export async function listIncomingRoomInvites(): Promise<RoomInvite[]> {
	const res = await signedFetch("/api/rooms/invites", { method: "GET" });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`listIncomingRoomInvites failed: ${res.status} ${text}`);
	}
	return (await res.json()) as RoomInvite[];
}

export async function acceptProjectRoomInvite(params: {
	roomId: string;
	projectName: string;
}): Promise<void> {
	await getRoomKey(params.roomId);
	upsertProjectRoomLink({
		projectName: params.projectName,
		roomId: params.roomId,
		createdAt: Date.now(),
	});
	logger.info("Accepted room invite", {
		roomId: params.roomId,
		projectName: params.projectName,
	});
}
