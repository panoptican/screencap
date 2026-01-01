import { describe, expect, it } from "vitest";
import {
	CAMEL_TO_SNAKE_MAP,
	toSnakeCase,
	transformRow,
	transformRows,
} from "../transformers";

describe("transformers", () => {
	describe("transformRow", () => {
		it("converts snake_case to camelCase", () => {
			const input = {
				id: "123",
				display_id: "display-1",
				created_at: 1234567890,
				end_timestamp: 1234567900,
			};

			const result = transformRow(input);

			expect(result).toEqual({
				id: "123",
				displayId: "display-1",
				createdAt: 1234567890,
				endTimestamp: 1234567900,
			});
		});

		it("handles empty objects", () => {
			expect(transformRow({})).toEqual({});
		});

		it("preserves already camelCase keys", () => {
			const input = { myKey: "value" };
			expect(transformRow(input)).toEqual({ myKey: "value" });
		});
	});

	describe("transformRows", () => {
		it("transforms array of rows", () => {
			const input = [
				{ user_id: 1, first_name: "John" },
				{ user_id: 2, first_name: "Jane" },
			];

			const result = transformRows(input);

			expect(result).toEqual([
				{ userId: 1, firstName: "John" },
				{ userId: 2, firstName: "Jane" },
			]);
		});

		it("handles empty array", () => {
			expect(transformRows([])).toEqual([]);
		});
	});

	describe("toSnakeCase", () => {
		it("maps known camelCase keys to snake_case", () => {
			expect(toSnakeCase("displayId")).toBe("display_id");
			expect(toSnakeCase("endTimestamp")).toBe("end_timestamp");
			expect(toSnakeCase("thumbnailPath")).toBe("thumbnail_path");
		});

		it("returns original key if not in map", () => {
			expect(toSnakeCase("unknownKey")).toBe("unknownKey");
			expect(toSnakeCase("status")).toBe("status");
		});
	});

	describe("CAMEL_TO_SNAKE_MAP", () => {
		it("contains all expected mappings", () => {
			expect(CAMEL_TO_SNAKE_MAP.displayId).toBe("display_id");
			expect(CAMEL_TO_SNAKE_MAP.endTimestamp).toBe("end_timestamp");
			expect(CAMEL_TO_SNAKE_MAP.trackedAddiction).toBe("tracked_addiction");
			expect(CAMEL_TO_SNAKE_MAP.addictionCandidate).toBe("addiction_candidate");
			expect(CAMEL_TO_SNAKE_MAP.thumbnailPath).toBe("thumbnail_path");
			expect(CAMEL_TO_SNAKE_MAP.originalPath).toBe("original_path");
			expect(CAMEL_TO_SNAKE_MAP.stableHash).toBe("stable_hash");
			expect(CAMEL_TO_SNAKE_MAP.detailHash).toBe("detail_hash");
			expect(CAMEL_TO_SNAKE_MAP.mergedCount).toBe("merged_count");
			expect(CAMEL_TO_SNAKE_MAP.createdAt).toBe("created_at");
			expect(CAMEL_TO_SNAKE_MAP.updatedAt).toBe("updated_at");
		});
	});
});
