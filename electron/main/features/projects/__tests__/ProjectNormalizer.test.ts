import { describe, expect, it } from "vitest";
import { normalizeProjectBase, projectKeyFromBase } from "../ProjectNormalizer";

describe("ProjectNormalizer", () => {
	describe("normalizeProjectBase", () => {
		it("returns null for null/undefined input", () => {
			expect(normalizeProjectBase(null)).toBeNull();
			expect(normalizeProjectBase(undefined)).toBeNull();
			expect(normalizeProjectBase("")).toBeNull();
		});

		it("trims and normalizes whitespace", () => {
			expect(normalizeProjectBase("  Project  Name  ")).toBe("Project Name");
		});

		it("strips outer quotes", () => {
			expect(normalizeProjectBase('"My Project"')).toBe("My Project");
			expect(normalizeProjectBase("'My Project'")).toBe("My Project");
			expect(normalizeProjectBase("`My Project`")).toBe("My Project");
		});

		it("removes tail stopwords", () => {
			expect(normalizeProjectBase("Project - Settings")).toBe("Project -");
			expect(normalizeProjectBase("Project Dashboard")).toBe("Project");
			expect(normalizeProjectBase("Screencap - Preferences")).toBe(
				"Screencap -",
			);
		});

		it("preserves case when uppercase exists", () => {
			expect(normalizeProjectBase("Screencap")).toBe("Screencap");
		});

		it("capitalizes first letter when all lowercase", () => {
			expect(normalizeProjectBase("myproject")).toBe("Myproject");
		});

		it("handles special characters", () => {
			expect(normalizeProjectBase("Project·Name")).toBe("Project Name");
			expect(normalizeProjectBase("Project/Name")).toBe("Project Name");
			expect(normalizeProjectBase("Project_Name")).toBe("Project Name");
		});
	});

	describe("projectKeyFromBase", () => {
		it("returns null for null input", () => {
			expect(projectKeyFromBase(null)).toBeNull();
		});

		it("creates lowercase alphanumeric key", () => {
			expect(projectKeyFromBase("My Project")).toBe("myproject");
			expect(projectKeyFromBase("Screencap App")).toBe("screencap");
		});

		it("handles unicode normalization", () => {
			expect(projectKeyFromBase("Café")).toBe("cafe");
		});

		it("removes non-alphanumeric characters", () => {
			expect(projectKeyFromBase("Project-123!")).toBe("project123");
		});
	});
});
