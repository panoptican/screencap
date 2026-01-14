import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../database";
import { formatProject } from "../formatters";

interface ProjectRow {
	project: string;
	event_count: number;
	progress_count: number;
	last_activity: number;
	total_duration: number;
}

export function registerProjectsResources(server: McpServer): void {
	server.registerResource(
		"projects-list",
		"screencap://projects",
		{ description: "List of all tracked projects" },
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
				contents: [
					{
						uri: "screencap://projects",
						mimeType: "application/json",
						text: JSON.stringify(projects, null, 2),
					},
				],
			};
		},
	);
}
