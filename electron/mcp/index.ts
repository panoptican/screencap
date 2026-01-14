import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { closeDatabase } from "./database.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

const server = new McpServer({
	name: "screencap",
	version: "1.0.0",
});

registerResources(server);
registerTools(server);
registerPrompts(server);

const transport = new StdioServerTransport();

process.on("SIGINT", () => {
	closeDatabase();
	process.exit(0);
});

process.on("SIGTERM", () => {
	closeDatabase();
	process.exit(0);
});

await server.connect(transport);
