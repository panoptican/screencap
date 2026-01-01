import { describe, expect, it } from "vitest";
import {
	chromiumProvider,
	getSupportedBrowserBundleIds,
} from "../providers/ChromiumProvider";
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

describe("chromiumProvider.supports", () => {
	it("supports Google Chrome", () => {
		const snapshot = createSnapshot("com.google.Chrome", "Google Chrome");
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("supports Google Chrome Canary", () => {
		const snapshot = createSnapshot(
			"com.google.Chrome.canary",
			"Google Chrome Canary",
		);
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("supports Brave Browser", () => {
		const snapshot = createSnapshot("com.brave.Browser", "Brave Browser");
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("supports Microsoft Edge", () => {
		const snapshot = createSnapshot("com.microsoft.edgemac", "Microsoft Edge");
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("supports Dia browser", () => {
		const snapshot = createSnapshot("company.thebrowser.dia", "Dia");
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("supports Opera", () => {
		const snapshot = createSnapshot("com.operasoftware.Opera", "Opera");
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("supports Vivaldi", () => {
		const snapshot = createSnapshot("com.vivaldi.Vivaldi", "Vivaldi");
		expect(chromiumProvider.supports(snapshot)).toBe(true);
	});

	it("does not support Safari", () => {
		const snapshot = createSnapshot("com.apple.Safari", "Safari");
		expect(chromiumProvider.supports(snapshot)).toBe(false);
	});

	it("does not support Firefox", () => {
		const snapshot = createSnapshot("org.mozilla.firefox", "Firefox");
		expect(chromiumProvider.supports(snapshot)).toBe(false);
	});

	it("does not support Arc (no AppleScript support)", () => {
		const snapshot = createSnapshot("company.thebrowser.Browser", "Arc");
		expect(chromiumProvider.supports(snapshot)).toBe(false);
	});

	it("does not support random apps", () => {
		const snapshot = createSnapshot("com.example.app", "Example App");
		expect(chromiumProvider.supports(snapshot)).toBe(false);
	});
});

describe("getSupportedBrowserBundleIds", () => {
	it("includes all Chromium browsers", () => {
		const bundleIds = getSupportedBrowserBundleIds();
		expect(bundleIds).toContain("com.google.Chrome");
		expect(bundleIds).toContain("com.brave.Browser");
		expect(bundleIds).toContain("company.thebrowser.dia");
	});

	it("includes Safari variants", () => {
		const bundleIds = getSupportedBrowserBundleIds();
		expect(bundleIds).toContain("com.apple.Safari");
		expect(bundleIds).toContain("com.apple.SafariTechnologyPreview");
	});

	it("does not include Arc", () => {
		const bundleIds = getSupportedBrowserBundleIds();
		expect(bundleIds).not.toContain("company.thebrowser.Browser");
	});
});

describe("chromiumProvider.id", () => {
	it("has correct provider id", () => {
		expect(chromiumProvider.id).toBe("chromium");
	});
});
