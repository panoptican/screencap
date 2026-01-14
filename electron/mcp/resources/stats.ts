import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase, getDayEnd, getDayStart, getWeekStart } from "../database";
import { formatTimeSummary } from "../formatters";

interface CategoryRow {
	category: string;
	total_duration: number;
	event_count: number;
}

function getCategoryStats(startDate: number, endDate: number): CategoryRow[] {
	const db = getDatabase();

	return db
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
		.all(startDate, endDate);
}

export function registerStatsResources(server: McpServer): void {
	server.registerResource(
		"stats-today",
		"screencap://stats/today",
		{ description: "Today's time statistics by category" },
		async () => {
			const dayStart = getDayStart();
			const dayEnd = getDayEnd();

			const rows = getCategoryStats(dayStart, dayEnd);
			const stats = rows.map((r) => ({
				category: r.category,
				totalMs: r.total_duration,
				count: r.event_count,
			}));

			const summary = formatTimeSummary(stats, "Today");

			return {
				contents: [
					{
						uri: "screencap://stats/today",
						mimeType: "application/json",
						text: JSON.stringify(summary, null, 2),
					},
				],
			};
		},
	);

	server.registerResource(
		"stats-week",
		"screencap://stats/week",
		{ description: "This week's time statistics by category" },
		async () => {
			const weekStart = getWeekStart();
			const now = Date.now();

			const rows = getCategoryStats(weekStart, now);
			const stats = rows.map((r) => ({
				category: r.category,
				totalMs: r.total_duration,
				count: r.event_count,
			}));

			const summary = formatTimeSummary(stats, "This Week");

			return {
				contents: [
					{
						uri: "screencap://stats/week",
						mimeType: "application/json",
						text: JSON.stringify(summary, null, 2),
					},
				],
			};
		},
	);
}
