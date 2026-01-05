import { generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	createRoomKeyEnvelope,
	decodeRoomKeyB64,
	decryptRoomEventPayload,
	decryptRoomImageBytes,
	deriveDmKey,
	encodeRoomKeyB64,
	encryptRoomEventPayload,
	encryptRoomImageBytes,
	generateRoomKey,
	openRoomKeyEnvelope,
} from "../RoomCrypto";

function spkiDerB64(key: unknown): string {
	return Buffer.from(
		(key as { export: (options: unknown) => unknown }).export({
			type: "spki",
			format: "der",
		}) as Buffer,
	).toString("base64");
}

function pkcs8DerB64(key: unknown): string {
	return Buffer.from(
		(key as { export: (options: unknown) => unknown }).export({
			type: "pkcs8",
			format: "der",
		}) as Buffer,
	).toString("base64");
}

describe("RoomCrypto", () => {
	it("encodes/decodes room keys", () => {
		const roomKey = generateRoomKey();
		const b64 = encodeRoomKeyB64(roomKey);
		const decoded = decodeRoomKeyB64(b64);
		expect(decoded.equals(roomKey)).toBe(true);
	});

	it("creates and opens room key envelopes", () => {
		const roomKey = generateRoomKey();
		const recipient = generateKeyPairSync("x25519");

		const envelope = createRoomKeyEnvelope({
			roomKey,
			recipientDhPubKeySpkiDerB64: spkiDerB64(recipient.publicKey),
		});

		const opened = openRoomKeyEnvelope({
			envelopeJson: JSON.stringify(envelope),
			recipientDhPrivKeyPkcs8DerB64: pkcs8DerB64(recipient.privateKey),
		});

		expect(opened.equals(roomKey)).toBe(true);
	});

	it("encrypts/decrypts room event payloads and detects tampering", () => {
		const roomKey = randomBytes(32);
		const payload = Buffer.from(
			JSON.stringify({ v: 2, caption: "hi", image: { ref: null, mime: "x" } }),
			"utf8",
		);

		const ciphertext = encryptRoomEventPayload({
			roomKey,
			payloadJsonUtf8: payload,
		});
		const decrypted = decryptRoomEventPayload({
			roomKey,
			payloadCiphertextB64: ciphertext,
		});
		expect(decrypted.toString("utf8")).toBe(payload.toString("utf8"));

		const bytes = Buffer.from(ciphertext, "base64");
		bytes[bytes.length - 1] ^= 1;
		expect(() =>
			decryptRoomEventPayload({
				roomKey,
				payloadCiphertextB64: bytes.toString("base64"),
			}),
		).toThrow();
	});

	it("encrypts/decrypts room image bytes", () => {
		const roomKey = randomBytes(32);
		const plaintext = Buffer.from([1, 2, 3, 4, 5]);

		const ciphertext = encryptRoomImageBytes({
			roomKey,
			plaintextBytes: plaintext,
		});
		const decrypted = decryptRoomImageBytes({
			roomKey,
			ciphertextBytes: ciphertext,
		});

		expect(decrypted.equals(plaintext)).toBe(true);
	});

	it("derives symmetric DM keys", () => {
		const a = generateKeyPairSync("x25519");
		const b = generateKeyPairSync("x25519");

		const aKey = deriveDmKey({
			myDhPrivKeyPkcs8DerB64: pkcs8DerB64(a.privateKey),
			peerDhPubKeySpkiDerB64: spkiDerB64(b.publicKey),
		});

		const bKey = deriveDmKey({
			myDhPrivKeyPkcs8DerB64: pkcs8DerB64(b.privateKey),
			peerDhPubKeySpkiDerB64: spkiDerB64(a.publicKey),
		});

		expect(aKey.equals(bKey)).toBe(true);
	});
});
