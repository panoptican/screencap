import { execFile } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	getAppIconPath,
	upsertAppIcon,
} from "../../infra/db/repositories/AppIconRepository";
import { getAppIconsDir } from "../../infra/paths";
import { broadcastEventsChanged } from "../../infra/windows";

const inflight = new Map<string, Promise<string | null>>();

function normalizeBundleId(bundleId: string): string {
	return bundleId.trim();
}

function safeFileBase(bundleId: string): string {
	return normalizeBundleId(bundleId)
		.toLowerCase()
		.replace(/[^a-z0-9.-]/g, "_");
}

function escapeMdfindString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function execFileText(
	command: string,
	args: string[],
	timeoutMs: number,
): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(
			command,
			args,
			{ timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 },
			(error, stdout) => {
				if (error) return resolve(null);
				const out = stdout.trim();
				return resolve(out ? out : null);
			},
		);
	});
}

function firstLine(output: string | null): string | null {
	if (!output) return null;
	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (trimmed) return trimmed;
	}
	return null;
}

async function resolveViaMdfind(bundleId: string): Promise<string | null> {
	const query = `kMDItemCFBundleIdentifier == "${escapeMdfindString(bundleId)}"`;
	const out = await execFileText("/usr/bin/mdfind", [query], 3000);
	const match = firstLine(out);
	if (match?.endsWith(".app") && existsSync(match)) return match;
	return null;
}

async function readBundleIdFromApp(appPath: string): Promise<string | null> {
	const plistPath = join(appPath, "Contents", "Info.plist");
	if (!existsSync(plistPath)) return null;

	const out = await execFileText(
		"/usr/libexec/PlistBuddy",
		["-c", "Print :CFBundleIdentifier", plistPath],
		500,
	);
	return out ? out.trim() : null;
}

async function scanDirectoryForBundleId(
	dir: string,
	bundleId: string,
): Promise<string | null> {
	if (!existsSync(dir)) return null;
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
			const appPath = join(dir, entry.name);
			const appBundleId = await readBundleIdFromApp(appPath);
			if (appBundleId === bundleId) return appPath;
		}
	} catch {}
	return null;
}

async function resolveViaDirectScan(bundleId: string): Promise<string | null> {
	const dirs = [
		"/Applications",
		"/System/Applications",
		"/System/Library/CoreServices/Applications",
		join(homedir(), "Applications"),
	];
	for (const dir of dirs) {
		const found = await scanDirectoryForBundleId(dir, bundleId);
		if (found) return found;
	}
	return null;
}

async function resolveApplicationPath(
	bundleId: string,
): Promise<string | null> {
	if (process.platform !== "darwin") return null;

	const mdfindResult = await resolveViaMdfind(bundleId);
	if (mdfindResult) return mdfindResult;

	return resolveViaDirectScan(bundleId);
}

async function readPlistValue(
	plistPath: string,
	key: string,
): Promise<string | null> {
	const out = await execFileText(
		"/usr/libexec/PlistBuddy",
		["-c", `Print :${key}`, plistPath],
		500,
	);
	return out ? out.trim() : null;
}

function findIcnsFile(appPath: string, iconName: string | null): string | null {
	const resourcesDir = join(appPath, "Contents", "Resources");
	if (!existsSync(resourcesDir)) return null;

	if (iconName) {
		const withExt = iconName.endsWith(".icns") ? iconName : `${iconName}.icns`;
		const iconPath = join(resourcesDir, withExt);
		if (existsSync(iconPath)) return iconPath;
	}

	try {
		const entries = readdirSync(resourcesDir);
		for (const entry of entries) {
			if (entry.endsWith(".icns")) {
				return join(resourcesDir, entry);
			}
		}
	} catch {}

	return null;
}

async function extractAppIconPng(appPath: string): Promise<Buffer | null> {
	const plistPath = join(appPath, "Contents", "Info.plist");
	if (!existsSync(plistPath)) return null;

	const iconFile = await readPlistValue(plistPath, "CFBundleIconFile");
	const iconName = await readPlistValue(plistPath, "CFBundleIconName");

	const icnsPath = findIcnsFile(appPath, iconFile ?? iconName);
	if (!icnsPath) return null;

	const outDir = getAppIconsDir();
	const tmpPng = join(outDir, `_tmp_${Date.now()}.png`);

	const result = await execFileText(
		"/usr/bin/sips",
		["-s", "format", "png", "-z", "128", "128", icnsPath, "--out", tmpPng],
		3000,
	);

	if (!result || !existsSync(tmpPng)) return null;

	try {
		const data = readFileSync(tmpPng);
		unlinkSync(tmpPng);
		return data.length > 0 ? data : null;
	} catch {
		return null;
	}
}

const MIN_VALID_ICON_SIZE = 2048;

function isValidIconFile(path: string): boolean {
	if (!existsSync(path)) return false;
	try {
		const stats = statSync(path);
		return stats.size >= MIN_VALID_ICON_SIZE;
	} catch {
		return false;
	}
}

export async function ensureAppIcon(bundleId: string): Promise<string | null> {
	const key = normalizeBundleId(bundleId);
	if (!key) return null;

	const existing = getAppIconPath(key);
	if (existing && isValidIconFile(existing)) return existing;

	if (existing && existsSync(existing)) {
		try {
			unlinkSync(existing);
		} catch {}
	}

	const inProgress = inflight.get(key);
	if (inProgress) return inProgress;

	const task = (async () => {
		const applicationPath = await resolveApplicationPath(key);
		if (!applicationPath || !existsSync(applicationPath)) return null;

		const png = await extractAppIconPng(applicationPath);
		if (!png) return null;

		const filePath = join(getAppIconsDir(), `${safeFileBase(key)}.png`);
		try {
			writeFileSync(filePath, png);
		} catch {
			return null;
		}

		upsertAppIcon(key, filePath, Date.now());
		broadcastEventsChanged();
		return filePath;
	})();

	inflight.set(key, task);
	try {
		return await task;
	} finally {
		inflight.delete(key);
	}
}
