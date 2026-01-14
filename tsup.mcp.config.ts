import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["electron/mcp/index.ts"],
	outDir: "dist-mcp",
	format: ["esm"],
	target: "node18",
	clean: true,
	splitting: false,
	sourcemap: true,
	dts: false,
	external: ["better-sqlite3"],
	banner: {
		js: "#!/usr/bin/env node",
	},
	esbuildOptions(options) {
		options.platform = "node";
	},
});
