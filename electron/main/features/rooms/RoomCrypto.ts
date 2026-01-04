import {
	createCipheriv,
	createDecipheriv,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync,
	randomBytes,
} from "node:crypto";

export type RoomKeyB64 = string;

export type RoomKeyEnvelopeV1 = {
	v: 1;
	ephemeralPub: string;
	nonce: string;
	ciphertext: string;
};

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function hkdf32(params: { ikm: Uint8Array; info: string }): Buffer {
	return Buffer.from(
		hkdfSync(
			"sha256",
			Buffer.from(params.ikm),
			Buffer.alloc(0),
			Buffer.from(params.info, "utf8"),
			32,
		),
	);
}

function aesGcmEncrypt(params: { key: Uint8Array; plaintext: Uint8Array }): {
	nonce: Buffer;
	ciphertextWithTag: Buffer;
} {
	const nonce = randomBytes(NONCE_BYTES);
	const cipher = createCipheriv("aes-256-gcm", Buffer.from(params.key), nonce);
	const ciphertext = Buffer.concat([
		cipher.update(Buffer.from(params.plaintext)),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return { nonce, ciphertextWithTag: Buffer.concat([ciphertext, tag]) };
}

function aesGcmDecrypt(params: {
	key: Uint8Array;
	nonce: Uint8Array;
	ciphertextWithTag: Uint8Array;
}): Buffer {
	const buf = Buffer.from(params.ciphertextWithTag);
	if (buf.length < TAG_BYTES) {
		throw new Error("Ciphertext too short");
	}
	const ciphertext = buf.subarray(0, buf.length - TAG_BYTES);
	const tag = buf.subarray(buf.length - TAG_BYTES);
	const decipher = createDecipheriv(
		"aes-256-gcm",
		Buffer.from(params.key),
		Buffer.from(params.nonce),
	);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function generateRoomKey(): Buffer {
	return randomBytes(32);
}

export function encodeRoomKeyB64(roomKey: Uint8Array): RoomKeyB64 {
	return Buffer.from(roomKey).toString("base64");
}

export function decodeRoomKeyB64(roomKeyB64: RoomKeyB64): Buffer {
	const buf = Buffer.from(roomKeyB64, "base64");
	if (buf.length !== 32) throw new Error("Invalid RoomKey length");
	return buf;
}

export function createRoomKeyEnvelope(params: {
	roomKey: Uint8Array;
	recipientDhPubKeySpkiDerB64: string;
}): RoomKeyEnvelopeV1 {
	const recipientPub = createPublicKey({
		key: Buffer.from(params.recipientDhPubKeySpkiDerB64, "base64"),
		format: "der",
		type: "spki",
	});

	const ephemeral = generateKeyPairSync("x25519");
	const sharedSecret = diffieHellman({
		privateKey: ephemeral.privateKey,
		publicKey: recipientPub,
	});

	const envelopeKey = hkdf32({ ikm: sharedSecret, info: "room-key-envelope" });
	const encrypted = aesGcmEncrypt({
		key: envelopeKey,
		plaintext: Buffer.from(params.roomKey),
	});

	const ephemeralPub = Buffer.from(
		ephemeral.publicKey.export({ format: "der", type: "spki" }) as Buffer,
	).toString("base64");

	return {
		v: 1,
		ephemeralPub,
		nonce: encrypted.nonce.toString("base64"),
		ciphertext: encrypted.ciphertextWithTag.toString("base64"),
	};
}

export function openRoomKeyEnvelope(params: {
	envelopeJson: string;
	recipientDhPrivKeyPkcs8DerB64: string;
}): Buffer {
	const parsed = JSON.parse(params.envelopeJson) as Partial<RoomKeyEnvelopeV1>;
	if (
		parsed.v !== 1 ||
		typeof parsed.ephemeralPub !== "string" ||
		typeof parsed.nonce !== "string" ||
		typeof parsed.ciphertext !== "string"
	) {
		throw new Error("Invalid envelope");
	}

	const recipientPriv = createPrivateKey({
		key: Buffer.from(params.recipientDhPrivKeyPkcs8DerB64, "base64"),
		format: "der",
		type: "pkcs8",
	});

	const ephemeralPub = createPublicKey({
		key: Buffer.from(parsed.ephemeralPub, "base64"),
		format: "der",
		type: "spki",
	});

	const sharedSecret = diffieHellman({
		privateKey: recipientPriv,
		publicKey: ephemeralPub,
	});
	const envelopeKey = hkdf32({ ikm: sharedSecret, info: "room-key-envelope" });

	return aesGcmDecrypt({
		key: envelopeKey,
		nonce: Buffer.from(parsed.nonce, "base64"),
		ciphertextWithTag: Buffer.from(parsed.ciphertext, "base64"),
	});
}

function deriveRoomSubkey(params: {
	roomKey: Uint8Array;
	info: string;
}): Buffer {
	return hkdf32({ ikm: Buffer.from(params.roomKey), info: params.info });
}

export function encryptRoomEventPayload(params: {
	roomKey: Uint8Array;
	payloadJsonUtf8: Uint8Array;
}): string {
	const key = deriveRoomSubkey({ roomKey: params.roomKey, info: "room-event" });
	const nonce = randomBytes(NONCE_BYTES);
	const cipher = createCipheriv("aes-256-gcm", key, nonce);
	const ciphertext = Buffer.concat([
		cipher.update(Buffer.from(params.payloadJsonUtf8)),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([nonce, ciphertext, tag]).toString("base64");
}

export function decryptRoomEventPayload(params: {
	roomKey: Uint8Array;
	payloadCiphertextB64: string;
}): Buffer {
	const data = Buffer.from(params.payloadCiphertextB64, "base64");
	if (data.length < NONCE_BYTES + TAG_BYTES)
		throw new Error("Ciphertext too short");
	const nonce = data.subarray(0, NONCE_BYTES);
	const tag = data.subarray(data.length - TAG_BYTES);
	const ciphertext = data.subarray(NONCE_BYTES, data.length - TAG_BYTES);
	const key = deriveRoomSubkey({ roomKey: params.roomKey, info: "room-event" });
	const decipher = createDecipheriv("aes-256-gcm", key, nonce);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptRoomImageBytes(params: {
	roomKey: Uint8Array;
	plaintextBytes: Uint8Array;
}): Buffer {
	const key = deriveRoomSubkey({ roomKey: params.roomKey, info: "room-image" });
	const nonce = randomBytes(NONCE_BYTES);
	const cipher = createCipheriv("aes-256-gcm", key, nonce);
	const ciphertext = Buffer.concat([
		cipher.update(Buffer.from(params.plaintextBytes)),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([nonce, ciphertext, tag]);
}

export function decryptRoomImageBytes(params: {
	roomKey: Uint8Array;
	ciphertextBytes: Uint8Array;
}): Buffer {
	const data = Buffer.from(params.ciphertextBytes);
	if (data.length < NONCE_BYTES + TAG_BYTES)
		throw new Error("Ciphertext too short");
	const nonce = data.subarray(0, NONCE_BYTES);
	const tag = data.subarray(data.length - TAG_BYTES);
	const ciphertext = data.subarray(NONCE_BYTES, data.length - TAG_BYTES);
	const key = deriveRoomSubkey({ roomKey: params.roomKey, info: "room-image" });
	const decipher = createDecipheriv("aes-256-gcm", key, nonce);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function deriveProjectChatKey(params: { roomKey: Uint8Array }): Buffer {
	return deriveRoomSubkey({ roomKey: params.roomKey, info: "chat" });
}

export function deriveDmKey(params: {
	myDhPrivKeyPkcs8DerB64: string;
	peerDhPubKeySpkiDerB64: string;
}): Buffer {
	const myPriv = createPrivateKey({
		key: Buffer.from(params.myDhPrivKeyPkcs8DerB64, "base64"),
		format: "der",
		type: "pkcs8",
	});
	const peerPub = createPublicKey({
		key: Buffer.from(params.peerDhPubKeySpkiDerB64, "base64"),
		format: "der",
		type: "spki",
	});
	const sharedSecret = diffieHellman({
		privateKey: myPriv,
		publicKey: peerPub,
	});
	return hkdf32({ ikm: sharedSecret, info: "dm" });
}

export function encryptWithKey(params: {
	key: Uint8Array;
	plaintextUtf8: Uint8Array;
}): string {
	const encrypted = aesGcmEncrypt({
		key: params.key,
		plaintext: params.plaintextUtf8,
	});
	return Buffer.concat([encrypted.nonce, encrypted.ciphertextWithTag]).toString(
		"base64",
	);
}

export function decryptWithKey(params: {
	key: Uint8Array;
	ciphertextB64: string;
}): Buffer {
	const data = Buffer.from(params.ciphertextB64, "base64");
	if (data.length < NONCE_BYTES + TAG_BYTES)
		throw new Error("Ciphertext too short");
	const nonce = data.subarray(0, NONCE_BYTES);
	const ciphertextWithTag = data.subarray(NONCE_BYTES);
	return aesGcmDecrypt({ key: params.key, nonce, ciphertextWithTag });
}
