import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { safeStorage } from "electron";
import { createLogger } from "../../infra/log";
import { getSocialAccountPath } from "../../infra/paths";

const logger = createLogger({ scope: "IdentityStore" });

export type StoredPrivateKeys = {
	signPrivKeyPkcs8DerB64: string;
	dhPrivKeyPkcs8DerB64: string;
};

type StoredPrivateKeysBlob = {
	scheme: "safeStorage" | "plain";
	payload: string;
};

export type StoredIdentity = {
	userId: string;
	deviceId: string;
	username: string;
	signPubKeySpkiDerB64: string;
	dhPubKeySpkiDerB64: string;
	privateKeys: StoredPrivateKeysBlob;
};

function isEncryptionAvailable(): boolean {
	return safeStorage.isEncryptionAvailable();
}

function encryptPrivateKeys(keys: StoredPrivateKeys): StoredPrivateKeysBlob {
	const json = JSON.stringify(keys);
	if (!isEncryptionAvailable()) {
		return { scheme: "plain", payload: json };
	}
	return {
		scheme: "safeStorage",
		payload: safeStorage.encryptString(json).toString("base64"),
	};
}

function decryptPrivateKeys(
	blob: StoredPrivateKeysBlob,
): StoredPrivateKeys | null {
	try {
		const json =
			blob.scheme === "safeStorage"
				? safeStorage.decryptString(Buffer.from(blob.payload, "base64"))
				: blob.payload;
		const parsed = JSON.parse(json) as Partial<StoredPrivateKeys>;
		if (
			typeof parsed.signPrivKeyPkcs8DerB64 !== "string" ||
			typeof parsed.dhPrivKeyPkcs8DerB64 !== "string"
		) {
			return null;
		}
		return {
			signPrivKeyPkcs8DerB64: parsed.signPrivKeyPkcs8DerB64,
			dhPrivKeyPkcs8DerB64: parsed.dhPrivKeyPkcs8DerB64,
		};
	} catch {
		return null;
	}
}

export function loadIdentity(): {
	identity: Omit<StoredIdentity, "privateKeys">;
	privateKeys: StoredPrivateKeys;
} | null {
	const path = getSocialAccountPath();
	if (!existsSync(path)) return null;

	try {
		const raw = readFileSync(path, "utf-8");
		const parsed = JSON.parse(raw) as Partial<StoredIdentity>;

		if (
			typeof parsed.userId !== "string" ||
			typeof parsed.deviceId !== "string" ||
			typeof parsed.username !== "string" ||
			typeof parsed.signPubKeySpkiDerB64 !== "string" ||
			typeof parsed.dhPubKeySpkiDerB64 !== "string" ||
			typeof parsed.privateKeys !== "object" ||
			parsed.privateKeys === null
		) {
			return null;
		}

		const blob = parsed.privateKeys as Partial<StoredPrivateKeysBlob>;
		if (
			(blob.scheme !== "safeStorage" && blob.scheme !== "plain") ||
			typeof blob.payload !== "string"
		) {
			return null;
		}

		const privateKeys = decryptPrivateKeys({
			scheme: blob.scheme,
			payload: blob.payload,
		});
		if (!privateKeys) return null;

		return {
			identity: {
				userId: parsed.userId,
				deviceId: parsed.deviceId,
				username: parsed.username,
				signPubKeySpkiDerB64: parsed.signPubKeySpkiDerB64,
				dhPubKeySpkiDerB64: parsed.dhPubKeySpkiDerB64,
			},
			privateKeys,
		};
	} catch (error) {
		logger.warn("Failed to load identity", { error: String(error) });
		return null;
	}
}

export function saveIdentity(params: {
	userId: string;
	deviceId: string;
	username: string;
	signPubKeySpkiDerB64: string;
	dhPubKeySpkiDerB64: string;
	privateKeys: StoredPrivateKeys;
}): void {
	const path = getSocialAccountPath();
	const identity: StoredIdentity = {
		userId: params.userId,
		deviceId: params.deviceId,
		username: params.username,
		signPubKeySpkiDerB64: params.signPubKeySpkiDerB64,
		dhPubKeySpkiDerB64: params.dhPubKeySpkiDerB64,
		privateKeys: encryptPrivateKeys(params.privateKeys),
	};
	writeFileSync(path, JSON.stringify(identity, null, 2));
}
