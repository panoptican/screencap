import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDailySummaryPrompt } from "./dailySummary";
import { registerFocusAnalysisPrompt } from "./focusAnalysis";
import { registerProjectStatusPrompt } from "./projectStatus";

export function registerPrompts(server: McpServer): void {
	registerDailySummaryPrompt(server);
	registerProjectStatusPrompt(server);
	registerFocusAnalysisPrompt(server);
}
