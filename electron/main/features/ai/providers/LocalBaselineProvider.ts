import type { ClassificationResult } from "../../../../shared/types";
import type { ClassificationProvider, ProviderAvailability } from "../types";

function compact(value: string | null): string | null {
	const v = (value ?? "").trim();
	return v.length === 0 ? null : v;
}

function buildCaption(context: {
	contentTitle: string | null;
	windowTitle: string | null;
	appName: string | null;
	urlHost: string | null;
}): string {
	const title =
		compact(context.contentTitle) ??
		compact(context.windowTitle) ??
		compact(context.appName) ??
		compact(context.urlHost);
	return title ?? "Screenshot captured";
}

export const localBaselineProvider: ClassificationProvider = {
	id: "local.baseline",

	async isAvailable(): Promise<ProviderAvailability> {
		return { available: true, reason: null };
	},

	async classify(input): Promise<ClassificationResult> {
		const caption = buildCaption({
			contentTitle: input.context?.contentTitle ?? null,
			windowTitle: input.context?.windowTitle ?? null,
			appName: input.context?.appName ?? null,
			urlHost: input.context?.urlHost ?? null,
		});

		return {
			category: "Unknown",
			subcategories: [],
			project: null,
			project_progress: { shown: false, confidence: 0 },
			tags: [],
			confidence: 0,
			caption,
			tracked_addiction: { detected: false, name: null },
			addiction_candidate: null,
			addiction_confidence: null,
			addiction_prompt: null,
		};
	},
};
