import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function canOpenSqlite() {
	try {
		const Database = require("better-sqlite3");
		const db = new Database(":memory:");
		db.close();
		return true;
	} catch {
		return false;
	}
}

if (canOpenSqlite()) {
	process.exit(0);
}

const env = { ...process.env };
if (process.platform === "darwin" && existsSync("/usr/bin/python3")) {
	env.PYTHON = "/usr/bin/python3";
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
	npmCmd,
	["rebuild", "better-sqlite3", "--build-from-source"],
	{
		stdio: "inherit",
		env,
	},
);
process.exit(result.status ?? 1);
