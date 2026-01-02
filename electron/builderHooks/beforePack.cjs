const { execFileSync } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");

function archToTarget(arch) {
	if (arch === 3 || arch === "arm64") return "arm64-apple-macos12.0";
	if (arch === 1 || arch === "x64") return "x86_64-apple-macos12.0";
	throw new Error(`Unsupported arch: ${arch}`);
}

module.exports = async (context) => {
	const projectDir = context.packager.projectDir;
	const target = archToTarget(context.arch);
	const src = join(projectDir, "electron", "ocr", "ScreencapOCR.swift");
	const outDir = join(projectDir, "build", "ocr");
	mkdirSync(outDir, { recursive: true });
	const out = join(outDir, "screencap-ocr");

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
};
