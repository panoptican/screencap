import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase, getDaysAgo } from "../database";
import {
	formatDuration,
	formatEventsForLLM,
	formatMarkdownEventList,
} from "../formatters";
import type { DbEvent } from "../types";

export function registerProjectStatusPrompt(server: McpServer): void {
	server.registerPrompt(
		"project_status",
		{
			description: "Get status summary for a specific project",
			argsSchema: {
				project: z.string().describe("Project name"),
			},
		},
		async (params) => {
			const db = getDatabase();
			const weekAgo = getDaysAgo(7);

			const events = db
				.prepare<[string, number], DbEvent>(
					`
          SELECT * FROM events
          WHERE project = ? AND timestamp >= ?
            AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
        `,
				)
				.all(params.project, weekAgo);

			const progressEvents = events.filter((e) => e.project_progress > 0);
			const totalMs = events.reduce((sum, e) => {
				const duration = (e.end_timestamp || e.timestamp + 60000) - e.timestamp;
				return sum + duration;
			}, 0);

			const formatted = formatEventsForLLM(events.slice(0, 20), true);
			const progressFormatted = formatEventsForLLM(
				progressEvents.slice(0, 10),
				true,
			);

			const eventList = formatMarkdownEventList(formatted);
			const progressList = formatMarkdownEventList(progressFormatted);

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `Here's the status for project "${params.project}" over the last 7 days:

## Overview
- Total time spent: ${formatDuration(totalMs)}
- Total events: ${events.length}
- Progress markers: ${progressEvents.length}

## Progress Events
${progressList || "No progress events recorded."}

## Recent Activity
${eventList}

Please provide a summary of the project status: what progress has been made, what seems to be the current focus, and any observations about the work pattern.`,
						},
					},
				],
			};
		},
	);
}
