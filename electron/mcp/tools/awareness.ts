import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase, getDayEnd, getDayStart } from "../database";
import { formatAddictionStats, formatFocusScore } from "../formatters";
import type { DbEvent, DbMemory } from "../types";

export function registerAwarenessTools(server: McpServer): void {
	server.registerTool(
		"get_addiction_stats",
		{
			description: "Get addiction tracking statistics",
			inputSchema: {
				name: z
					.string()
					.optional()
					.describe("Specific addiction name (optional)"),
				days: z.number().default(14).describe("Number of days to analyze"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const addictions = db
				.prepare<[], DbMemory>(`SELECT * FROM memory WHERE type = 'addiction'`)
				.all();

			if (addictions.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ message: "No addictions tracked" }),
						},
					],
				};
			}

			const now = Date.now();
			const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
			const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

			const targetAddictions = params.name
				? addictions.filter((a) =>
						a.content.toLowerCase().includes(params.name!.toLowerCase()),
					)
				: addictions;

			const stats = targetAddictions.map((addiction) => {
				const thisWeekEvents = db
					.prepare<[string, number], { count: number }>(
						`
            SELECT COUNT(*) as count FROM events
            WHERE tracked_addiction = ? AND timestamp >= ?
              AND dismissed = 0
          `,
					)
					.get(addiction.content, weekAgo);

				const lastWeekEvents = db
					.prepare<[string, number, number], { count: number }>(
						`
            SELECT COUNT(*) as count FROM events
            WHERE tracked_addiction = ? AND timestamp >= ? AND timestamp < ?
              AND dismissed = 0
          `,
					)
					.get(addiction.content, twoWeeksAgo, weekAgo);

				const lastIncident = db
					.prepare<[string], { timestamp: number } | undefined>(
						`
            SELECT timestamp FROM events
            WHERE tracked_addiction = ? AND dismissed = 0
            ORDER BY timestamp DESC
            LIMIT 1
          `,
					)
					.get(addiction.content);

				return formatAddictionStats(
					addiction.content,
					lastIncident?.timestamp ?? null,
					thisWeekEvents?.count ?? 0,
					lastWeekEvents?.count ?? 0,
				);
			});

			return {
				content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_focus_score",
		{
			description: "Get focus/distraction score for a day",
			inputSchema: {
				date: z
					.string()
					.optional()
					.describe("Date string (YYYY-MM-DD) or 'today'"),
			},
		},
		async (params) => {
			const db = getDatabase();

			let targetDate: Date;
			if (!params.date || params.date === "today") {
				targetDate = new Date();
			} else {
				targetDate = new Date(params.date);
			}

			const dayStart = getDayStart(targetDate);
			const dayEnd = getDayEnd(targetDate);

			const events = db
				.prepare<[number, number], DbEvent>(
					`
          SELECT * FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
        `,
				)
				.all(dayStart, dayEnd);

			const focusCategories = ["Work", "Study"];
			let focusMs = 0;
			let distractionMs = 0;
			const distractionCounts: Record<string, number> = {};

			for (const event of events) {
				const duration =
					(event.end_timestamp || event.timestamp + 60000) - event.timestamp;

				if (event.tracked_addiction) {
					distractionMs += duration;
					distractionCounts[event.tracked_addiction] =
						(distractionCounts[event.tracked_addiction] || 0) + duration;
				} else if (event.category && focusCategories.includes(event.category)) {
					focusMs += duration;
				}
			}

			const topDistractions = Object.entries(distractionCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([name, ms]) => ({ name, ms }));

			const score = formatFocusScore(
				targetDate,
				focusMs,
				distractionMs,
				focusCategories,
				topDistractions,
			);

			return {
				content: [{ type: "text", text: JSON.stringify(score, null, 2) }],
			};
		},
	);
}
