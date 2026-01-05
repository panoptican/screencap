import { existsSync } from "node:fs";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createTempDir } from "../../../testUtils/tmp";

let userDataDir = "";
let cleanup: (() => Promise<void>) | null = null;

const netFetch = vi.fn();

const faviconPaths = new Map<string, string>();
const getFaviconPath = vi.fn((host: string) => faviconPaths.get(host) ?? null);
const upsertFavicon = vi.fn((host: string, path: string) => {
	faviconPaths.set(host, path);
});

const broadcastEventsChanged = vi.fn();

vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => {
			if (name === "userData") return userDataDir;
			throw new Error("Unsupported app.getPath");
		},
	},
	net: {
		fetch: netFetch,
	},
}));

vi.mock("../../../infra/db/repositories/FaviconRepository", () => ({
	getFaviconPath,
	upsertFavicon,
}));

vi.mock("../../../infra/windows", () => ({
	broadcastEventsChanged,
}));

describe("ensureFavicon", () => {
	beforeAll(async () => {
		const tmp = await createTempDir("screencap-favicon-test-");
		userDataDir = tmp.dir;
		cleanup = tmp.cleanup;
	});

	afterAll(async () => {
		await cleanup?.();
	});

	beforeEach(() => {
		faviconPaths.clear();
		vi.clearAllMocks();
		vi.resetModules();
	});

	it("blocks localhost/private ranges", async () => {
		const { ensureFavicon } = await import("../FaviconService");

		const res = await ensureFavicon("localhost", null);
		expect(res).toBeNull();
		expect(netFetch).not.toHaveBeenCalled();
		expect(upsertFavicon).not.toHaveBeenCalled();
	});

	it("dedupes inflight requests and persists a downloaded icon", async () => {
		netFetch.mockImplementation(async (url: string) => {
			if (url === "https://example.com" || url === "https://example.com/") {
				return new Response(
					`<html><head><link rel="icon" href="/icon.png"></head></html>`,
					{ status: 200, headers: { "content-type": "text/html" } },
				);
			}
			if (url === "https://example.com/icon.png") {
				return new Response(new Uint8Array([1, 2, 3]), {
					status: 200,
					headers: { "content-type": "image/png" },
				});
			}
			return new Response("", { status: 404 });
		});

		const { ensureFavicon } = await import("../FaviconService");

		const [a, b] = await Promise.all([
			ensureFavicon("example.com", null),
			ensureFavicon("example.com", null),
		]);

		expect(a).toBeTruthy();
		expect(a).toBe(b);
		expect(typeof a).toBe("string");
		expect(existsSync(a as string)).toBe(true);
		expect(upsertFavicon).toHaveBeenCalledTimes(1);
		expect(broadcastEventsChanged).toHaveBeenCalledTimes(1);
		expect(netFetch).toHaveBeenCalledTimes(2);
	});
});
