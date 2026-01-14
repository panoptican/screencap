import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase, getDayStart, getHoursAgo } from "../database";
import { formatEventsForLLM } from "../formatters";
import type { DbEvent } from "../types";

export function registerActivityResources(server: McpServer): void {
	server.registerResource(
		"activity-today",
		"screencap://activity/today",
		{ description: "Today's activity events" },
		async () => {
			const db = getDatabase();
			const dayStart = getDayStart();

			const events = db
				.prepare<[number], DbEvent>(
					`
        SELECT *
        FROM events
        WHERE timestamp >= ? AND dismissed = 0 AND status = 'completed'
        ORDER BY timestamp DESC
      `,
				)
				.all(dayStart);

			const formatted = formatEventsForLLM(events, false);

			return {
				contents: [
					{
						uri: "screencap://activity/today",
						mimeType: "application/json",
						text: JSON.stringify(formatted, null, 2),
					},
				],
			};
		},
	);

	server.registerResource(
		"activity-recent",
		"screencap://activity/recent",
		{ description: "Recent activity (last 2 hours)" },
		async () => {
			const db = getDatabase();
			const twoHoursAgo = getHoursAgo(2);

			const events = db
				.prepare<[number], DbEvent>(
					`
          SELECT *
          FROM events
          WHERE timestamp >= ? AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
          LIMIT 50
        `,
				)
				.all(twoHoursAgo);

			const formatted = formatEventsForLLM(events, false);

			return {
				contents: [
					{
						uri: "screencap://activity/recent",
						mimeType: "application/json",
						text: JSON.stringify(formatted, null, 2),
					},
				],
			};
		},
	);
}
