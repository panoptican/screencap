import type { EventSummary, PeriodType } from "../../../shared/types";
import { createLogger } from "../../infra/log";
import { callOpenRouterRaw } from "./OpenRouterClient";
import { buildStoryPrompt } from "./prompts";

const logger = createLogger({ scope: "StoryService" });

function formatHm(timestamp: number): string {
	const d = new Date(timestamp);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

function formatEventLine(e: EventSummary): string {
	const parts: string[] = [formatHm(e.timestamp), e.caption, e.category];
	if (e.project) parts.push(`project:${e.project}`);
	if (e.projectProgress) parts.push("progress:true");
	return `- ${parts.join(" · ")}`;
}

export async function generateStory(
	events: EventSummary[],
	periodType: PeriodType,
): Promise<string> {
	logger.debug("Generating story...", {
		eventCount: events.length,
		periodType,
	});

	const eventSummary = events.map(formatEventLine).join("\n");

	const content = await callOpenRouterRaw([
		{ role: "system", content: buildStoryPrompt(periodType) },
		{
			role: "user",
			content: `Here are my screen activities for this ${periodType === "daily" ? "day" : "week"}:\n\n${eventSummary}\n\nGenerate my ${periodType} wrapped journal using the required format.`,
		},
	]);

	logger.debug("Story generated");
	return content || "Unable to generate summary.";
}
