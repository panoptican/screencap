import { describe, expect, it } from "vitest";
import type { Memory } from "../../../../shared/types";
import { buildAddictionOptions, buildStoryPrompt } from "../prompts";

describe("prompts", () => {
	describe("buildAddictionOptions", () => {
		it("filters only addiction type memories", () => {
			const memories: Memory[] = [
				{
					id: "1",
					type: "addiction",
					content: "Twitter",
					createdAt: 1,
					updatedAt: 1,
				},
				{
					id: "2",
					type: "project",
					content: "Screencap",
					createdAt: 1,
					updatedAt: 1,
				},
				{
					id: "3",
					type: "addiction",
					content: "YouTube",
					createdAt: 1,
					updatedAt: 1,
				},
			];

			const result = buildAddictionOptions(memories);

			expect(result).toEqual([
				{ id: "1", name: "Twitter", definition: "Twitter" },
				{ id: "3", name: "YouTube", definition: "YouTube" },
			]);
		});

		it("includes optional description in addiction definition", () => {
			const memories: Memory[] = [
				{
					id: "1",
					type: "addiction",
					content: "Chess",
					description: "chess.com and lichess.org",
					createdAt: 1,
					updatedAt: 1,
				},
			];

			expect(buildAddictionOptions(memories)).toEqual([
				{
					id: "1",
					name: "Chess",
					definition: "Chess\nAbout: chess.com and lichess.org",
				},
			]);
		});

		it("returns empty array when no addictions", () => {
			const memories: Memory[] = [
				{
					id: "1",
					type: "project",
					content: "Project",
					createdAt: 1,
					updatedAt: 1,
				},
			];

			expect(buildAddictionOptions(memories)).toEqual([]);
		});

		it("handles empty input", () => {
			expect(buildAddictionOptions([])).toEqual([]);
		});
	});

	describe("buildStoryPrompt", () => {
		it("generates daily prompt", () => {
			const prompt = buildStoryPrompt("daily");
			expect(prompt).toContain("daily");
			expect(prompt).toContain("summaries");
		});

		it("generates weekly prompt", () => {
			const prompt = buildStoryPrompt("weekly");
			expect(prompt).toContain("weekly");
			expect(prompt).toContain("summaries");
		});

		it("includes required sections", () => {
			const prompt = buildStoryPrompt("daily");
			expect(prompt).toContain("productivity");
			expect(prompt).toContain("categories");
			expect(prompt).toContain("addiction");
			expect(prompt).toContain("improvement");
		});
	});
});
