import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase, getDayEnd, getDayStart } from "../database";
import {
	formatDate,
	formatEventsForLLM,
	formatMarkdownEventList,
	formatMarkdownTimeSummary,
	formatTimeSummary,
} from "../formatters";
import type { DbEvent } from "../types";

interface CategoryRow {
	category: string;
	total_duration: number;
	event_count: number;
}

export function registerDailySummaryPrompt(server: McpServer): void {
	server.registerPrompt(
		"daily_summary",
		{
			description: "Summarize activity for a specific day",
			argsSchema: {
				date: z
					.string()
					.optional()
					.describe("Date in YYYY-MM-DD format (defaults to today)"),
			},
		},
		async (params) => {
			const db = getDatabase();

			let targetDate: Date;
			if (!params.date) {
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
          ORDER BY timestamp ASC
        `,
				)
				.all(dayStart, dayEnd);

			const categoryRows = db
				.prepare<[number, number], CategoryRow>(
					`
          SELECT 
            COALESCE(category, 'Unknown') as category,
            SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
            COUNT(*) as event_count
          FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
          GROUP BY category
          ORDER BY total_duration DESC
        `,
				)
				.all(dayStart, dayEnd);

			const formatted = formatEventsForLLM(events, false);
			const stats = categoryRows.map((r) => ({
				category: r.category,
				totalMs: r.total_duration,
				count: r.event_count,
			}));
			const summary = formatTimeSummary(stats, formatDate(dayStart));

			const eventList = formatMarkdownEventList(formatted);
			const statsSummary = formatMarkdownTimeSummary(summary);

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `Here's my activity data for ${formatDate(dayStart)}:

## Time Breakdown
${statsSummary}

## Activity Timeline (${events.length} events)
${eventList}

Please provide an honest summary of how I spent my time, what I accomplished, and any patterns you notice (good or concerning). Be direct and constructive.`,
						},
					},
				],
			};
		},
	);
}
