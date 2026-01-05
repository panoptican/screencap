import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDir } from "../../../testUtils/tmp";

let userDataDir = "";
let cleanup: (() => Promise<void>) | null = null;

let encryptionAvailable = true;

const encryptString = vi.fn((value: string) =>
	Buffer.from(`enc:${value}`, "utf8"),
);
const decryptString = vi.fn((buf: Buffer) => {
	const raw = buf.toString("utf8");
	return raw.startsWith("enc:") ? raw.slice(4) : raw;
});

vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => {
			if (name === "userData") return userDataDir;
			throw new Error("Unsupported app.getPath");
		},
	},
	safeStorage: {
		isEncryptionAvailable: () => encryptionAvailable,
		encryptString,
		decryptString,
	},
}));

describe("IdentityStore", () => {
	beforeEach(async () => {
		const tmp = await createTempDir("screencap-identity-test-");
		userDataDir = tmp.dir;
		cleanup = tmp.cleanup;
		encryptionAvailable = true;
		vi.clearAllMocks();
		vi.resetModules();
	});

	afterEach(async () => {
		await cleanup?.();
		userDataDir = "";
		cleanup = null;
	});

	it("stores private keys encrypted when safeStorage is available", async () => {
		const { loadIdentity, saveIdentity } = await import("../IdentityStore");

		saveIdentity({
			userId: "u1",
			deviceId: "d1",
			username: "alice",
			signPubKeySpkiDerB64: "spk",
			dhPubKeySpkiDerB64: "dpk",
			privateKeys: {
				signPrivKeyPkcs8DerB64: "spriv",
				dhPrivKeyPkcs8DerB64: "dpriv",
			},
		});

		const raw = JSON.parse(
			readFileSync(`${userDataDir}/social-account.json`, "utf8"),
		) as {
			privateKeys: { scheme: string; payload: string };
		};

		expect(raw.privateKeys.scheme).toBe("safeStorage");
		expect(typeof raw.privateKeys.payload).toBe("string");

		const loaded = loadIdentity();
		expect(loaded?.identity.username).toBe("alice");
		expect(loaded?.privateKeys.signPrivKeyPkcs8DerB64).toBe("spriv");
		expect(loaded?.privateKeys.dhPrivKeyPkcs8DerB64).toBe("dpriv");
	});

	it("stores private keys in plaintext when safeStorage is unavailable", async () => {
		encryptionAvailable = false;

		const { loadIdentity, saveIdentity } = await import("../IdentityStore");

		saveIdentity({
			userId: "u1",
			deviceId: "d1",
			username: "alice",
			signPubKeySpkiDerB64: "spk",
			dhPubKeySpkiDerB64: "dpk",
			privateKeys: {
				signPrivKeyPkcs8DerB64: "spriv",
				dhPrivKeyPkcs8DerB64: "dpriv",
			},
		});

		const raw = JSON.parse(
			readFileSync(`${userDataDir}/social-account.json`, "utf8"),
		) as {
			privateKeys: { scheme: string; payload: string };
		};

		expect(raw.privateKeys.scheme).toBe("plain");
		expect(raw.privateKeys.payload).toContain("spriv");
		expect(encryptString).not.toHaveBeenCalled();

		const loaded = loadIdentity();
		expect(loaded?.identity.username).toBe("alice");
		expect(loaded?.privateKeys.signPrivKeyPkcs8DerB64).toBe("spriv");
		expect(loaded?.privateKeys.dhPrivKeyPkcs8DerB64).toBe("dpriv");
	});
});
