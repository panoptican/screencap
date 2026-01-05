import {
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

let userDataDir = "";
let handleRequest:
	| ((request: { method: string; url: string }) => Promise<Response> | Response)
	| null = null;

const netFetch = vi.fn();
const protocolHandle = vi.fn(
	(
		scheme: string,
		handler: (request: { method: string; url: string }) => Promise<Response>,
	) => {
		if (scheme === "local-file") {
			handleRequest = handler;
		}
	},
);

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
	protocol: {
		handle: protocolHandle,
	},
}));

describe("local-file protocol", () => {
	beforeAll(() => {
		userDataDir = mkdtempSync(join(tmpdir(), "screencap-protocol-test-"));
	});

	afterAll(() => {
		rmSync(userDataDir, { recursive: true, force: true });
	});

	beforeEach(async () => {
		handleRequest = null;
		vi.clearAllMocks();
		netFetch.mockResolvedValue(new Response("ok", { status: 200 }));
		const { registerProtocols } = await import("../protocol");
		registerProtocols();
		expect(protocolHandle).toHaveBeenCalled();
		expect(handleRequest).not.toBeNull();
	});

	it("rejects non-GET methods", async () => {
		const res = await handleRequest?.({
			method: "POST",
			url: "local-file://x",
		});
		expect(res?.status).toBe(405);
	});

	it("rejects empty path", async () => {
		const res = await handleRequest?.({ method: "GET", url: "local-file://" });
		expect(res?.status).toBe(400);
	});

	it("returns 404 for missing files", async () => {
		const missingPath = join(userDataDir, "screenshots", "missing.png");
		const url = `local-file://${missingPath}`;
		const res = await handleRequest?.({ method: "GET", url });
		expect(res?.status).toBe(404);
	});

	it("blocks paths outside screenshots root", async () => {
		const outsidePath = join(userDataDir, "outside.txt");
		writeFileSync(outsidePath, "x");
		const url = `local-file://${outsidePath}`;
		const res = await handleRequest?.({ method: "GET", url });
		expect(res?.status).toBe(403);
	});

	it("blocks symlink escapes", async () => {
		const outsidePath = join(userDataDir, "outside2.txt");
		writeFileSync(outsidePath, "x");
		const linkPath = join(userDataDir, "screenshots", "link.txt");
		symlinkSync(outsidePath, linkPath);
		const url = `local-file://${linkPath}`;
		const res = await handleRequest?.({ method: "GET", url });
		expect(res?.status).toBe(403);
	});

	it("serves files within screenshots root via net.fetch(file://...)", async () => {
		const allowedPath = join(userDataDir, "screenshots", "allowed.txt");
		writeFileSync(allowedPath, "ok");
		const url = `local-file://${allowedPath}`;

		const res = await handleRequest?.({ method: "GET", url });
		expect(res?.status).toBe(200);
		expect(netFetch).toHaveBeenCalledWith(
			pathToFileURL(realpathSync(allowedPath)).href,
		);
	});
});
