const { app } = await import("electron");

const debug = process.env.SCREENCAP_MCP_DEBUG === "1";

const isMcpMode =
	process.argv.includes("--mcp") ||
	app.commandLine.hasSwitch("mcp") ||
	process.env.SCREENCAP_MCP === "1";

if (debug) {
	process.stderr.write(
		`main: argv=${JSON.stringify(process.argv)} hasSwitch(mcp)=${String(app.commandLine.hasSwitch("mcp"))} env(SCREENCAP_MCP)=${String(process.env.SCREENCAP_MCP)} isMcpMode=${String(isMcpMode)}\n`,
	);
}

if (isMcpMode) {
	void app.whenReady().then(() => {
		app.dock?.hide();
	});
	const { startMcpServer } = await import("../mcp/server");
	await startMcpServer();
} else {
	const { bootstrap } = await import("./app");
	bootstrap();
}

export {};
