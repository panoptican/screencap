import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActivityResources } from "./activity";
import { registerMemoriesResources } from "./memories";
import { registerProjectsResources } from "./projects";
import { registerStatsResources } from "./stats";
import { registerStoriesResources } from "./stories";

export function registerResources(server: McpServer): void {
	registerActivityResources(server);
	registerStatsResources(server);
	registerProjectsResources(server);
	registerStoriesResources(server);
	registerMemoriesResources(server);
}
