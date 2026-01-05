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

describe("SettingsStore", () => {
	beforeEach(async () => {
		const tmp = await createTempDir("screencap-settings-test-");
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

	it("encrypts apiKey at rest when safeStorage is available", async () => {
		const { getSettings, invalidateCache, setSettings } = await import(
			"../SettingsStore"
		);

		const base = getSettings();
		setSettings({ ...base, apiKey: "secret" });

		const raw = JSON.parse(
			readFileSync(`${userDataDir}/settings.json`, "utf8"),
		) as { apiKey: string | null };

		expect(raw.apiKey).not.toBe("secret");
		expect(typeof raw.apiKey).toBe("string");
		expect(encryptString).toHaveBeenCalledWith("secret");

		invalidateCache();
		const reread = getSettings();
		expect(reread.apiKey).toBe("secret");
	});

	it("stores apiKey in plaintext when safeStorage is unavailable", async () => {
		encryptionAvailable = false;

		const { getSettings, invalidateCache, setSettings } = await import(
			"../SettingsStore"
		);

		const base = getSettings();
		setSettings({ ...base, apiKey: "secret" });

		const raw = JSON.parse(
			readFileSync(`${userDataDir}/settings.json`, "utf8"),
		) as { apiKey: string | null };

		expect(raw.apiKey).toBe("secret");
		expect(encryptString).not.toHaveBeenCalled();

		invalidateCache();
		const reread = getSettings();
		expect(reread.apiKey).toBe("secret");
	});
});
