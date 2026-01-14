import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase, getDayEnd, getDayStart, getWeekStart } from "../database";
import { formatDate, formatDateShort, formatDuration } from "../formatters";
import type { DbEvent, DbMemory } from "../types";

export function registerFocusAnalysisPrompt(server: McpServer): void {
	server.registerPrompt(
		"focus_analysis",
		{
			description: "Analyze focus and distraction patterns",
			argsSchema: {
				period: z
					.enum(["today", "week"])
					.default("today")
					.describe("Analysis period"),
			},
		},
		async (params) => {
			const db = getDatabase();

			let startDate: number;
			let endDate: number;
			let periodLabel: string;

			if (params.period === "week") {
				startDate = getWeekStart();
				endDate = Date.now();
				periodLabel = `This week (${formatDateShort(startDate)} - ${formatDateShort(endDate)})`;
			} else {
				startDate = getDayStart();
				endDate = getDayEnd();
				periodLabel = formatDate(startDate);
			}

			const events = db
				.prepare<[number, number], DbEvent>(
					`
          SELECT * FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
        `,
				)
				.all(startDate, endDate);

			const addictions = db
				.prepare<[], DbMemory>(`SELECT * FROM memory WHERE type = 'addiction'`)
				.all();

			const focusCategories = ["Work", "Study"];
			const categoryTimes: Record<string, number> = {};
			const addictionTimes: Record<string, number> = {};
			let focusMs = 0;
			let distractionMs = 0;
			let otherMs = 0;

			for (const event of events) {
				const duration =
					(event.end_timestamp || event.timestamp + 60000) - event.timestamp;
				const category = event.category || "Unknown";

				categoryTimes[category] = (categoryTimes[category] || 0) + duration;

				if (event.tracked_addiction) {
					distractionMs += duration;
					addictionTimes[event.tracked_addiction] =
						(addictionTimes[event.tracked_addiction] || 0) + duration;
				} else if (focusCategories.includes(category)) {
					focusMs += duration;
				} else {
					otherMs += duration;
				}
			}

			const totalMs = focusMs + distractionMs + otherMs;
			const focusPercent =
				totalMs > 0 ? Math.round((focusMs / totalMs) * 100) : 0;
			const distractionPercent =
				totalMs > 0 ? Math.round((distractionMs / totalMs) * 100) : 0;

			const categoryBreakdown = Object.entries(categoryTimes)
				.sort((a, b) => b[1] - a[1])
				.map(([cat, ms]) => `- ${cat}: ${formatDuration(ms)}`)
				.join("\n");

			const addictionBreakdown = Object.entries(addictionTimes)
				.sort((a, b) => b[1] - a[1])
				.map(([name, ms]) => `- ${name}: ${formatDuration(ms)}`)
				.join("\n");

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `Here's my focus analysis for ${periodLabel}:

## Summary
- **Total tracked time**: ${formatDuration(totalMs)}
- **Focus time** (Work + Study): ${formatDuration(focusMs)} (${focusPercent}%)
- **Distraction time** (tracked addictions): ${formatDuration(distractionMs)} (${distractionPercent}%)
- **Other activities**: ${formatDuration(otherMs)}

## Category Breakdown
${categoryBreakdown}

## Tracked Distractions
${addictionBreakdown || "No distractions tracked."}

## Tracked Addictions
${addictions.map((a) => `- ${a.content}${a.description ? `: ${a.description}` : ""}`).join("\n") || "None configured."}

Please analyze my focus patterns. Be honest about:
1. How well am I focusing?
2. What are my main distractions?
3. Any concerning patterns?
4. Suggestions for improvement?`,
						},
					},
				],
			};
		},
	);
}
