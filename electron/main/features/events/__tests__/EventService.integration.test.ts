import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDb, initTestDb } from "../../../testUtils/db";
import { createTempDir } from "../../../testUtils/tmp";

let userDataDir = "";
let cleanup: (() => Promise<void>) | null = null;

vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => {
			if (name === "userData") return userDataDir;
			throw new Error("Unsupported app.getPath");
		},
	},
	safeStorage: {
		isEncryptionAvailable: () => false,
		encryptString: (value: string) => Buffer.from(value, "utf8"),
		decryptString: (buf: Buffer) => buf.toString("utf8"),
	},
	BrowserWindow: {
		getAllWindows: () => [],
	},
}));

vi.mock("../../appIcons/AppIconService", () => ({
	ensureAppIcon: () => Promise.resolve(null),
}));

vi.mock("../../favicons/FaviconService", () => ({
	ensureFavicon: () => Promise.resolve(null),
}));

function createFile(path: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, "x");
}

async function waitForGone(path: string): Promise<void> {
	for (let i = 0; i < 20; i++) {
		if (!existsSync(path)) return;
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
	}
	expect(existsSync(path)).toBe(false);
}

describe("EventService.processCaptureGroup (integration)", () => {
	beforeEach(async () => {
		const tmp = await createTempDir("screencap-event-int-");
		userDataDir = tmp.dir;
		cleanup = tmp.cleanup;
		vi.resetModules();
		await initTestDb();
	});

	afterEach(async () => {
		await closeTestDb();
		await cleanup?.();
		userDataDir = "";
		cleanup = null;
	});

	it("merges similar captures into the latest event and deletes new files", async () => {
		const { insertEvent, getEventById } = await import(
			"../../../infra/db/repositories/EventRepository"
		);
		const { processCaptureGroup } = await import("../EventService");

		const stableHash = "0".repeat(16);
		const detailHash = "0".repeat(64);

		const now = Date.now();
		insertEvent({
			id: "e_prev",
			timestamp: now - 10_000,
			endTimestamp: now - 5_000,
			displayId: "1",
			stableHash,
			detailHash,
			mergedCount: 1,
			dismissed: 0,
			status: "completed",
		});

		const thumb = join(userDataDir, "files", "t.webp");
		const orig = join(userDataDir, "files", "o.webp");
		const high = join(userDataDir, "files", "o.hq.png");
		createFile(thumb);
		createFile(orig);
		createFile(high);

		const result = await processCaptureGroup({
			captures: [
				{
					id: "c1",
					timestamp: now,
					displayId: "1",
					thumbnailPath: thumb,
					originalPath: orig,
					stableHash,
					detailHash,
					width: 100,
					height: 100,
				},
			],
			intervalMs: 60_000,
			primaryDisplayId: "1",
			context: null,
		});

		expect(result).toEqual({ merged: true, eventId: "e_prev" });

		const updated = getEventById("e_prev");
		expect(updated?.endTimestamp).toBe(now);
		expect(updated?.mergedCount).toBe(2);

		await Promise.all([
			waitForGone(thumb),
			waitForGone(orig),
			waitForGone(high),
		]);
	});

	it("creates a new event, inserts screenshots, and enqueues to queue when enabled", async () => {
		const { getEventById } = await import(
			"../../../infra/db/repositories/EventRepository"
		);
		const { getEventScreenshots } = await import(
			"../../../infra/db/repositories/EventScreenshotRepository"
		);
		const { isEventQueued } = await import(
			"../../../infra/db/repositories/QueueRepository"
		);
		const { processCaptureGroup } = await import("../EventService");

		const stableHash = "1".repeat(16);
		const detailHash = "2".repeat(64);
		const now = Date.now();

		const primaryThumb = join(userDataDir, "files", "p_t.webp");
		const primaryOrig = join(userDataDir, "files", "p_o.webp");
		const secondaryThumb = join(userDataDir, "files", "s_t.webp");
		const secondaryOrig = join(userDataDir, "files", "s_o.webp");
		createFile(primaryThumb);
		createFile(primaryOrig);
		createFile(secondaryThumb);
		createFile(secondaryOrig);

		const result = await processCaptureGroup({
			captures: [
				{
					id: "e_new",
					timestamp: now,
					displayId: "1",
					thumbnailPath: primaryThumb,
					originalPath: primaryOrig,
					stableHash,
					detailHash,
					width: 100,
					height: 100,
				},
				{
					id: "e_new_s2",
					timestamp: now,
					displayId: "2",
					thumbnailPath: secondaryThumb,
					originalPath: secondaryOrig,
					stableHash,
					detailHash,
					width: 200,
					height: 200,
				},
			],
			intervalMs: 60_000,
			primaryDisplayId: "1",
			context: null,
		});

		expect(result).toEqual({ merged: false, eventId: "e_new" });

		const evt = getEventById("e_new");
		expect(evt?.id).toBe("e_new");
		expect(evt?.status).toBe("pending");

		const shots = getEventScreenshots("e_new");
		expect(shots).toHaveLength(2);
		expect(shots[0]?.isPrimary).toBe(true);
		expect(shots[0]?.displayId).toBe("1");

		expect(isEventQueued("e_new")).toBe(true);
	});

	it("does not enqueue when enqueueToLlmQueue is false", async () => {
		const { isEventQueued } = await import(
			"../../../infra/db/repositories/QueueRepository"
		);
		const { processCaptureGroup } = await import("../EventService");

		const stableHash = "a".repeat(16);
		const detailHash = "b".repeat(64);
		const now = Date.now();

		const primaryThumb = join(userDataDir, "files", "p2_t.webp");
		const primaryOrig = join(userDataDir, "files", "p2_o.webp");
		createFile(primaryThumb);
		createFile(primaryOrig);

		const result = await processCaptureGroup({
			captures: [
				{
					id: "e_new2",
					timestamp: now,
					displayId: "1",
					thumbnailPath: primaryThumb,
					originalPath: primaryOrig,
					stableHash,
					detailHash,
					width: 100,
					height: 100,
				},
			],
			intervalMs: 60_000,
			primaryDisplayId: "1",
			context: null,
			enqueueToLlmQueue: false,
		});

		expect(result).toEqual({ merged: false, eventId: "e_new2" });
		expect(isEventQueued("e_new2")).toBe(false);
	});

	it("marks event failed when the primary original file is missing", async () => {
		const { getEventById } = await import(
			"../../../infra/db/repositories/EventRepository"
		);
		const { isEventQueued } = await import(
			"../../../infra/db/repositories/QueueRepository"
		);
		const { processCaptureGroup } = await import("../EventService");

		const stableHash = "c".repeat(16);
		const detailHash = "d".repeat(64);
		const now = Date.now();

		const primaryThumb = join(userDataDir, "files", "p3_t.webp");
		const primaryOrig = join(userDataDir, "files", "p3_o.webp");
		createFile(primaryThumb);

		const result = await processCaptureGroup({
			captures: [
				{
					id: "e_missing",
					timestamp: now,
					displayId: "1",
					thumbnailPath: primaryThumb,
					originalPath: primaryOrig,
					stableHash,
					detailHash,
					width: 100,
					height: 100,
				},
			],
			intervalMs: 60_000,
			primaryDisplayId: "1",
			context: null,
		});

		expect(result).toEqual({ merged: false, eventId: "e_missing" });
		expect(isEventQueued("e_missing")).toBe(false);
		expect(getEventById("e_missing")?.status).toBe("failed");
	});
});
