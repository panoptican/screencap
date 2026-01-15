const { execFileSync, execSync } = require("node:child_process");
const { mkdirSync, existsSync, statSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

function archToTarget(arch) {
	if (arch === 3 || arch === "arm64") return "arm64-apple-macos12.0";
	if (arch === 1 || arch === "x64") return "x86_64-apple-macos12.0";
	throw new Error(`Unsupported arch: ${arch}`);
}

function archToName(arch) {
	if (arch === 3 || arch === "arm64") return "arm64";
	if (arch === 1 || arch === "x64") return "x64";
	throw new Error(`Unsupported arch: ${arch}`);
}

function getLatestMtime(dir) {
	let latest = 0;
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			latest = Math.max(latest, getLatestMtime(fullPath));
		} else {
			latest = Math.max(latest, statSync(fullPath).mtimeMs);
		}
	}
	return latest;
}

function buildMcpServer(projectDir) {
	const mcpSrcDir = join(projectDir, "electron", "mcp");
	const mcpOutFile = join(projectDir, "dist-mcp", "index.js");

	const srcMtime = getLatestMtime(mcpSrcDir);
	if (existsSync(mcpOutFile)) {
		const outMtime = statSync(mcpOutFile).mtimeMs;
		if (outMtime > srcMtime) {
			console.log("MCP server is up to date, skipping build");
			return;
		}
	}

	console.log("Building MCP server...");
	execSync("npm run build:mcp", { cwd: projectDir, stdio: "inherit" });
}

function buildOcrBinary(projectDir, arch) {
	const archName = archToName(arch);
	const target = archToTarget(arch);
	const src = join(projectDir, "electron", "ocr", "ScreencapOCR.swift");
	const outDir = join(projectDir, "build", "ocr", archName);
	mkdirSync(outDir, { recursive: true });
	const out = join(outDir, "screencap-ocr");

	const srcStat = statSync(src);
	if (existsSync(out)) {
		const outStat = statSync(out);
		if (outStat.mtime > srcStat.mtime) {
			console.log(`OCR binary for ${archName} is up to date, skipping compile`);
			return;
		}
	}

	console.log(`Compiling OCR binary for ${archName}...`);
	execFileSync(
		"xcrun",
		[
			"--sdk",
			"macosx",
			"swiftc",
			src,
			"-O",
			"-target",
			target,
			"-o",
			out,
			"-framework",
			"Vision",
			"-framework",
			"ImageIO",
			"-framework",
			"CoreGraphics",
		],
		{ stdio: "inherit" },
	);
}

module.exports = async (context) => {
	const projectDir = context.packager.projectDir;

	buildMcpServer(projectDir);
	buildOcrBinary(projectDir, context.arch);
};
