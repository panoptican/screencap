import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnalyticsTools } from "./analytics";
import { registerAwarenessTools } from "./awareness";
import { registerEventTools } from "./events";
import { registerProjectTools } from "./projects";

export function registerTools(server: McpServer): void {
	registerEventTools(server);
	registerAnalyticsTools(server);
	registerProjectTools(server);
	registerAwarenessTools(server);
}
