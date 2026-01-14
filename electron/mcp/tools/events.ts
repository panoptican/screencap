import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase, getHoursAgo } from "../database";
import { formatEventsForLLM } from "../formatters";
import { getImageBase64, getMimeType } from "../images";
import type { DbEvent } from "../types";

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type ContentItem = TextContent | ImageContent;

export function registerEventTools(server: McpServer): void {
	server.registerTool(
		"query_events",
		{
			description: "Query activity events with flexible filters",
			inputSchema: {
				startDate: z.number().optional().describe("Start timestamp (ms)"),
				endDate: z.number().optional().describe("End timestamp (ms)"),
				category: z
					.string()
					.optional()
					.describe("Filter by category (Work, Study, Leisure, etc.)"),
				project: z.string().optional().describe("Filter by project name"),
				app: z.string().optional().describe("Filter by app name"),
				urlHost: z.string().optional().describe("Filter by website host"),
				limit: z
					.number()
					.default(50)
					.describe("Maximum number of events to return"),
				includeImages: z
					.boolean()
					.default(false)
					.describe("Include screenshot images"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const conditions: string[] = ["dismissed = 0", "status = 'completed'"];
			const values: (string | number)[] = [];

			if (params.startDate) {
				conditions.push("timestamp >= ?");
				values.push(params.startDate);
			}
			if (params.endDate) {
				conditions.push("timestamp <= ?");
				values.push(params.endDate);
			}
			if (params.category) {
				conditions.push("category = ?");
				values.push(params.category);
			}
			if (params.project) {
				conditions.push("project = ?");
				values.push(params.project);
			}
			if (params.app) {
				conditions.push("app_name LIKE ?");
				values.push(`%${params.app}%`);
			}
			if (params.urlHost) {
				conditions.push("url_host = ?");
				values.push(params.urlHost);
			}

			const query = `
        SELECT * FROM events
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp DESC
        LIMIT ?
      `;
			values.push(params.limit);

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
		"search_events",
		{
			description: "Full-text search across captions and window titles",
			inputSchema: {
				query: z.string().describe("Search query"),
				startDate: z.number().optional().describe("Start timestamp (ms)"),
				endDate: z.number().optional().describe("End timestamp (ms)"),
				limit: z
					.number()
					.default(20)
					.describe("Maximum number of events to return"),
				includeImages: z
					.boolean()
					.default(false)
					.describe("Include screenshot images"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const conditions: string[] = [
				"dismissed = 0",
				"status = 'completed'",
				"(caption LIKE ? OR window_title LIKE ? OR app_name LIKE ?)",
			];
			const searchPattern = `%${params.query}%`;
			const values: (string | number)[] = [
				searchPattern,
				searchPattern,
				searchPattern,
			];

			if (params.startDate) {
				conditions.push("timestamp >= ?");
				values.push(params.startDate);
			}
			if (params.endDate) {
				conditions.push("timestamp <= ?");
				values.push(params.endDate);
			}

			const sql = `
        SELECT * FROM events
        WHERE ${conditions.join(" AND ")}
        ORDER BY timestamp DESC
        LIMIT ?
      `;
			values.push(params.limit);

			const events = db.prepare<unknown[], DbEvent>(sql).all(...values);
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
		"get_recent_activity",
		{
			description: "Get recent activity events (quick context)",
			inputSchema: {
				hours: z.number().default(2).describe("Number of hours to look back"),
				limit: z.number().default(30).describe("Maximum number of events"),
				includeImages: z
					.boolean()
					.default(false)
					.describe("Include screenshot images"),
			},
		},
		async (params) => {
			const db = getDatabase();
			const since = getHoursAgo(params.hours);

			const events = db
				.prepare<[number, number], DbEvent>(
					`
          SELECT * FROM events
          WHERE timestamp >= ? AND dismissed = 0 AND status = 'completed'
          ORDER BY timestamp DESC
          LIMIT ?
        `,
				)
				.all(since, params.limit);

			const formatted = formatEventsForLLM(events, false);

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
		"get_event_image",
		{
			description: "Get the screenshot image for a specific event",
			inputSchema: {
				eventId: z.string().describe("The event ID"),
			},
		},
		async (params) => {
			const db = getDatabase();

			const event = db
				.prepare<[string], DbEvent>(`SELECT * FROM events WHERE id = ?`)
				.get(params.eventId);

			if (!event) {
				return {
					content: [{ type: "text" as const, text: "Event not found" }],
				};
			}

			const imagePath = event.original_path || event.thumbnail_path;
			const base64 = getImageBase64(imagePath);

			if (!base64) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No image available for this event",
						},
					],
				};
			}

			return {
				content: [
					{
						type: "image" as const,
						data: base64,
						mimeType: getMimeType(imagePath),
					},
				],
			};
		},
	);
}
