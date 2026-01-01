import { describe, expect, it } from "vitest";
import { safariProvider } from "../providers/SafariProvider";
import type {
	ForegroundApp,
	ForegroundSnapshot,
	ForegroundWindow,
} from "../types";

function createSnapshot(bundleId: string, appName: string): ForegroundSnapshot {
	const app: ForegroundApp = {
		name: appName,
		bundleId,
		pid: 1234,
	};
	const window: ForegroundWindow = {
		title: "Test Window",
		bounds: { x: 0, y: 0, width: 1920, height: 1080 },
		displayId: "1",
		isFullscreen: false,
	};
	return { capturedAt: Date.now(), app, window };
}

describe("safariProvider.supports", () => {
	it("supports Safari", () => {
		const snapshot = createSnapshot("com.apple.Safari", "Safari");
		expect(safariProvider.supports(snapshot)).toBe(true);
	});

	it("supports Safari Technology Preview", () => {
		const snapshot = createSnapshot(
			"com.apple.SafariTechnologyPreview",
			"Safari Technology Preview",
		);
		expect(safariProvider.supports(snapshot)).toBe(true);
	});

	it("does not support Chrome", () => {
		const snapshot = createSnapshot("com.google.Chrome", "Google Chrome");
		expect(safariProvider.supports(snapshot)).toBe(false);
	});

	it("does not support Firefox", () => {
		const snapshot = createSnapshot("org.mozilla.firefox", "Firefox");
		expect(safariProvider.supports(snapshot)).toBe(false);
	});

	it("does not support random apps", () => {
		const snapshot = createSnapshot("com.example.app", "Example App");
		expect(safariProvider.supports(snapshot)).toBe(false);
	});
});

describe("safariProvider.id", () => {
	it("has correct provider id", () => {
		expect(safariProvider.id).toBe("safari");
	});
});
