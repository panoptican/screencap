import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase, getDaysAgo } from "../database";
import {
	formatDuration,
	formatEventsForLLM,
	formatProject,
} from "../formatters";
import { getImageBase64, getMimeType } from "../images";
import type { DbEvent } from "../types";

interface ProjectRow {
	project: string;
	event_count: number;
	progress_count: number;
	last_activity: number;
	total_duration: number;
}

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ContentItem = TextContent | ImageContent;

export function registerProjectTools(server: McpServer): void {
	server.registerTool(
		"get_project_progress",
		{
			description: "Get progress events for a project",
			inputSchema: {
				project: z.string().describe("Project name"),
				startDate: z.number().optional().describe("Start timestamp (ms)"),
				endDate: z.number().optional().describe("End timestamp (ms)"),
				includeImages: z
					.boolean()
					.default(false)
					.describe("Include screenshot images"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const conditions: string[] = [
				"project = ?",
				"project_progress > 0",
				"dismissed = 0",
				"status = 'completed'",
			];
			const values: (string | number)[] = [params.project];

			if (params.startDate) {
				conditions.push("timestamp >= ?");
				values.push(params.startDate);
			}
			if (params.endDate) {
				conditions.push("timestamp <= ?");
				values.push(params.endDate);
			}

			const query = `
        SELECT * FROM events
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp DESC
        LIMIT 50
      `;

			const events = db.prepare<unknown[], DbEvent>(query).all(...values);
			const formatted = formatEventsForLLM(events, true);

			const content: ContentItem[] = [
				{ type: "text", text: JSON.stringify(formatted, null, 2) },
			];

			if (params.includeImages) {
				for (const event of events) {
					const imagePath = event.original_path || event.thumbnail_path;
					const base64 = getImageBase64(imagePath);
					if (base64) {
						content.push({
							type: "image",
							data: base64,
							mimeType: getMimeType(imagePath),
						});
					}
				}
			}

			return { content };
		},
	);

	server.registerTool(
		"list_projects",
		{
			description: "List all projects with event counts and last activity",
		},
		async () => {
			const db = getDatabase();

			const rows = db
				.prepare<[], ProjectRow>(
					`
          SELECT 
            project,
            COUNT(*) as event_count,
            SUM(CASE WHEN project_progress > 0 THEN 1 ELSE 0 END) as progress_count,
            MAX(timestamp) as last_activity,
            SUM(COALESCE(end_timestamp, timestamp + 60000) - timestamp) as total_duration
          FROM events
          WHERE project IS NOT NULL AND project != ''
            AND dismissed = 0 AND status = 'completed'
          GROUP BY project
          ORDER BY last_activity DESC
        `,
				)
				.all();

			const projects = rows.map((r) =>
				formatProject(
					r.project,
					r.event_count,
					r.progress_count,
					r.last_activity,
					r.total_duration,
				),
			);

			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(projects, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_project_stats",
		{
			description: "Get detailed statistics for a project",
			inputSchema: {
				project: z.string().describe("Project name"),
				days: z.number().default(7).describe("Number of days to analyze"),
			},
		},
		async (params) => {
			const db = getDatabase();
			const since = getDaysAgo(params.days);

			const events = db
				.prepare<[string, number], DbEvent>(
					`
          SELECT * FROM events
          WHERE project = ? AND timestamp >= ?
            AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
        `,
				)
				.all(params.project, since);

			const progressCount = events.filter((e) => e.project_progress > 0).length;
			const totalMs = events.reduce((sum, e) => {
				const duration = (e.end_timestamp || e.timestamp + 60000) - e.timestamp;
				return sum + duration;
			}, 0);

			const appCounts: Record<string, number> = {};
			for (const e of events) {
				if (e.app_name) {
					appCounts[e.app_name] = (appCounts[e.app_name] || 0) + 1;
				}
			}
			const topApps = Object.entries(appCounts)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([app]) => app);

			const recentEvents = formatEventsForLLM(events.slice(0, 10), true);

			const stats = {
				name: params.project,
				period: `Last ${params.days} days`,
				eventCount: events.length,
				progressCount,
				totalTime: formatDuration(totalMs),
				topApps,
				recentActivity: recentEvents,
			};

			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(stats, null, 2) },
				],
			};
		},
	);
}
