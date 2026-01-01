import { describe, expect, it } from "vitest";
import { canonicalizeUrl, extractHost, extractPath } from "../url";

describe("canonicalizeUrl", () => {
	it("strips tracking parameters", () => {
		const url =
			"https://example.com/page?id=123&utm_source=google&utm_medium=cpc";
		const result = canonicalizeUrl(url);
		expect(result).toBe("https://example.com/page?id=123");
	});

	it("preserves non-tracking parameters", () => {
		const url = "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42";
		const result = canonicalizeUrl(url);
		expect(result).toBe("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42");
	});

	it("removes hash fragments", () => {
		const url = "https://example.com/page#section";
		const result = canonicalizeUrl(url);
		expect(result).toBe("https://example.com/page");
	});

	it("handles URLs with no query params", () => {
		const url = "https://example.com/path/to/page";
		const result = canonicalizeUrl(url);
		expect(result).toBe("https://example.com/path/to/page");
	});

	it("returns null for invalid URLs", () => {
		const result = canonicalizeUrl("not-a-url");
		expect(result).toBeNull();
	});

	it("removes fbclid", () => {
		const url = "https://example.com/page?fbclid=abc123";
		const result = canonicalizeUrl(url);
		expect(result).toBe("https://example.com/page");
	});
});

describe("extractHost", () => {
	it("extracts hostname from URL", () => {
		expect(extractHost("https://www.youtube.com/watch?v=abc")).toBe(
			"www.youtube.com",
		);
		expect(extractHost("https://netflix.com/watch/123")).toBe("netflix.com");
	});

	it("returns null for invalid URLs", () => {
		expect(extractHost("not-a-url")).toBeNull();
	});
});

describe("extractPath", () => {
	it("extracts pathname from URL", () => {
		expect(extractPath("https://youtube.com/watch?v=abc")).toBe("/watch");
		expect(extractPath("https://netflix.com/watch/12345")).toBe("/watch/12345");
	});

	it("returns null for invalid URLs", () => {
		expect(extractPath("not-a-url")).toBeNull();
	});
});
