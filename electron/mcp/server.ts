import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { closeDatabase } from "./database";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerTools } from "./tools";

export async function startMcpServer(): Promise<void> {
	const debug = process.env.SCREENCAP_MCP_DEBUG === "1";

	if (debug) {
		process.stderr.write("mcp: starting\n");
		process.stdin.on("data", (chunk) => {
			const size = Buffer.isBuffer(chunk)
				? chunk.length
				: Buffer.byteLength(String(chunk));
			process.stderr.write(`mcp: stdin ${size}\n`);
		});
	}

	const server = new McpServer({
		name: "screencap",
		version: "1.0.0",
	});

	registerResources(server);
	registerTools(server);
	registerPrompts(server);

	const shutdown = () => {
		closeDatabase();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.stdin.on("end", shutdown);
	process.stdin.on("close", shutdown);

	const transport = new StdioServerTransport();
	await server.connect(transport);

	if (debug) {
		process.stderr.write("mcp: connected\n");
	}
}
