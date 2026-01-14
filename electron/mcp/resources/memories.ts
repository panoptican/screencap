import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase, getDayEnd, getDayStart } from "../database";
import type { DbEodEntry, DbMemory } from "../types";

export function registerMemoriesResources(server: McpServer): void {
	server.registerResource(
		"memories",
		"screencap://memories",
		{ description: "User memories (projects, addictions, preferences)" },
		async () => {
			const db = getDatabase();

			const memories = db
				.prepare<[], DbMemory>(
					`
        SELECT *
        FROM memory
        ORDER BY updated_at DESC
      `,
				)
				.all();

			const formatted = memories.map((m) => ({
				id: m.id,
				type: m.type,
				name: m.content,
				description: m.description,
			}));

			const grouped = {
				projects: formatted.filter((m) => m.type === "project"),
				addictions: formatted.filter((m) => m.type === "addiction"),
				preferences: formatted.filter((m) => m.type === "preference"),
			};

			return {
				contents: [
					{
						uri: "screencap://memories",
						mimeType: "application/json",
						text: JSON.stringify(grouped, null, 2),
					},
				],
			};
		},
	);

	server.registerResource(
		"eod-today",
		"screencap://eod/today",
		{ description: "Today's end-of-day entry" },
		async () => {
			const db = getDatabase();
			const dayStart = getDayStart();
			const dayEnd = getDayEnd();

			const entry = db
				.prepare<[number, number], DbEodEntry>(
					`
        SELECT *
        FROM eod_entries
        WHERE day_start >= ? AND day_end <= ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
				)
				.get(dayStart, dayEnd);

			if (!entry) {
				return {
					contents: [
						{
							uri: "screencap://eod/today",
							mimeType: "application/json",
							text: JSON.stringify({
								exists: false,
								message: "No end-of-day entry for today",
							}),
						},
					],
				};
			}

			let parsedContent: unknown;
			try {
				parsedContent = JSON.parse(entry.content);
			} catch {
				parsedContent = entry.content;
			}

			return {
				contents: [
					{
						uri: "screencap://eod/today",
						mimeType: "application/json",
						text: JSON.stringify(
							{
								exists: true,
								submitted: entry.submitted_at !== null,
								content: parsedContent,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
