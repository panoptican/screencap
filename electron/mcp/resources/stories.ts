import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../database";
import { formatDateShort } from "../formatters";
import type { DbStory } from "../types";

export function registerStoriesResources(server: McpServer): void {
	server.registerResource(
		"stories-latest",
		"screencap://stories/latest",
		{ description: "Latest generated stories" },
		async () => {
			const db = getDatabase();

			const stories = db
				.prepare<[], DbStory>(
					`
        SELECT *
        FROM stories
        ORDER BY created_at DESC
        LIMIT 5
      `,
				)
				.all();

			const formatted = stories.map((s) => ({
				id: s.id,
				type: s.period_type,
				period: `${formatDateShort(s.period_start)} - ${formatDateShort(s.period_end)}`,
				content: s.content,
				createdAt: formatDateShort(s.created_at),
			}));

			return {
				contents: [
					{
						uri: "screencap://stories/latest",
						mimeType: "application/json",
						text: JSON.stringify(formatted, null, 2),
					},
				],
			};
		},
	);
}
