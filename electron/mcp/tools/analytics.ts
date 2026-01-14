import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "../database";
import {
	formatAppUsage,
	formatDateShort,
	formatPeriodComparison,
	formatTimeSummary,
	formatWebsiteUsage,
} from "../formatters";

interface CategoryRow {
	category: string;
	total_duration: number;
	event_count: number;
}

interface AppRow {
	app_name: string;
	total_duration: number;
	event_count: number;
}

interface HostRow {
	url_host: string;
	total_duration: number;
	event_count: number;
}

export function registerAnalyticsTools(server: McpServer): void {
	server.registerTool(
		"get_time_summary",
		{
			description: "Get category/time breakdown for a period",
			inputSchema: {
				startDate: z.number().describe("Start timestamp (ms)"),
				endDate: z.number().describe("End timestamp (ms)"),
				groupBy: z
					.enum(["category", "project"])
					.default("category")
					.describe("Group by category or project"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const groupColumn = params.groupBy === "project" ? "project" : "category";

			const rows = db
				.prepare<[number, number], CategoryRow>(
					`
          SELECT 
            COALESCE(${groupColumn}, 'Unknown') as category,
            SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
            COUNT(*) as event_count
          FROM events
          WHERE timestamp >= ? AND timestamp <= ?
            AND dismissed = 0 AND status = 'completed'
          GROUP BY ${groupColumn}
          ORDER BY total_duration DESC
        `,
				)
				.all(params.startDate, params.endDate);

			const stats = rows.map((r) => ({
				category: r.category,
				totalMs: r.total_duration,
				count: r.event_count,
			}));

			const periodLabel = `${formatDateShort(params.startDate)} - ${formatDateShort(params.endDate)}`;
			const summary = formatTimeSummary(stats, periodLabel);

			return {
				content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_app_usage",
		{
			description: "Get app usage statistics",
			inputSchema: {
				startDate: z.number().optional().describe("Start timestamp (ms)"),
				endDate: z.number().optional().describe("End timestamp (ms)"),
				limit: z
					.number()
					.default(10)
					.describe("Maximum number of apps to return"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const conditions: string[] = [
				"dismissed = 0",
				"status = 'completed'",
				"app_name IS NOT NULL",
			];
			const values: number[] = [];

			if (params.startDate) {
				conditions.push("timestamp >= ?");
				values.push(params.startDate);
			}
			if (params.endDate) {
				conditions.push("timestamp <= ?");
				values.push(params.endDate);
			}

			const query = `
        SELECT 
          app_name,
          SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
          COUNT(*) as event_count
        FROM events
        WHERE ${conditions.join(" AND ")}
        GROUP BY app_name
        ORDER BY total_duration DESC
        LIMIT ?
      `;
			values.push(params.limit);

			const rows = db.prepare<unknown[], AppRow>(query).all(...values);

			const totalMs = rows.reduce((sum, r) => sum + r.total_duration, 0);
			const formatted = formatAppUsage(
				rows.map((r) => ({
					app: r.app_name,
					totalMs: r.total_duration,
					count: r.event_count,
				})),
				totalMs,
			);

			return {
				content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_website_usage",
		{
			description: "Get website usage statistics",
			inputSchema: {
				startDate: z.number().optional().describe("Start timestamp (ms)"),
				endDate: z.number().optional().describe("End timestamp (ms)"),
				limit: z
					.number()
					.default(10)
					.describe("Maximum number of websites to return"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const conditions: string[] = [
				"dismissed = 0",
				"status = 'completed'",
				"url_host IS NOT NULL",
			];
			const values: number[] = [];

			if (params.startDate) {
				conditions.push("timestamp >= ?");
				values.push(params.startDate);
			}
			if (params.endDate) {
				conditions.push("timestamp <= ?");
				values.push(params.endDate);
			}

			const query = `
        SELECT 
          url_host,
          SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration,
          COUNT(*) as event_count
        FROM events
        WHERE ${conditions.join(" AND ")}
        GROUP BY url_host
        ORDER BY total_duration DESC
        LIMIT ?
      `;
			values.push(params.limit);

			const rows = db.prepare<unknown[], HostRow>(query).all(...values);

			const totalMs = rows.reduce((sum, r) => sum + r.total_duration, 0);
			const formatted = formatWebsiteUsage(
				rows.map((r) => ({
					host: r.url_host,
					totalMs: r.total_duration,
					count: r.event_count,
				})),
				totalMs,
			);

			return {
				content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
			};
		},
	);

	server.registerTool(
		"compare_periods",
		{
			description: "Compare productivity across two time periods",
			inputSchema: {
				period1Start: z.number().describe("Period 1 start timestamp (ms)"),
				period1End: z.number().describe("Period 1 end timestamp (ms)"),
				period2Start: z.number().describe("Period 2 start timestamp (ms)"),
				period2End: z.number().describe("Period 2 end timestamp (ms)"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const focusCategories = ["Work", "Study"];

			function getPeriodStats(start: number, end: number) {
				const events = db
					.prepare<
						[number, number],
						{ category: string | null; duration: number }
					>(
						`
            SELECT 
              category,
              COALESCE(end_timestamp, timestamp + 60000) - timestamp as duration
            FROM events
            WHERE timestamp >= ? AND timestamp <= ?
              AND dismissed = 0 AND status = 'completed'
          `,
					)
					.all(start, end);

				let focusMs = 0;
				let distractionMs = 0;

				for (const e of events) {
					if (e.category && focusCategories.includes(e.category)) {
						focusMs += e.duration;
					} else {
						distractionMs += e.duration;
					}
				}

				return { focusMs, distractionMs, count: events.length };
			}

			const stats1 = getPeriodStats(params.period1Start, params.period1End);
			const stats2 = getPeriodStats(params.period2Start, params.period2End);

			const comparison = formatPeriodComparison(
				`${formatDateShort(params.period1Start)} - ${formatDateShort(params.period1End)}`,
				`${formatDateShort(params.period2Start)} - ${formatDateShort(params.period2End)}`,
				stats1,
				stats2,
			);

			return {
				content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
			};
		},
	);
}
