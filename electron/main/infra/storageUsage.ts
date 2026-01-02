import type { Dirent } from "node:fs";
import { lstat, readdir, rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { app } from "electron";
import type {
	ClearableStorageCategory,
	StorageUsageBreakdown,
	StorageUsageEntry,
} from "../../shared/types";

function isSubpath(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function createEntriesMap(): Map<
	string,
	{
		label: string;
		path: string;
		bytes: number;
		clearable: boolean;
	}
> {
	return new Map([
		[
			"originals",
			{
				label: "Originals",
				path: "screenshots/originals",
				bytes: 0,
				clearable: false,
			},
		],
		[
			"thumbnails",
			{
				label: "Thumbnails",
				path: "screenshots/thumbnails",
				bytes: 0,
				clearable: true,
			},
		],
		[
			"favicons",
			{
				label: "Favicons",
				path: "screenshots/favicons",
				bytes: 0,
				clearable: true,
			},
		],
		[
			"appicons",
			{
				label: "App icons",
				path: "screenshots/appicons",
				bytes: 0,
				clearable: true,
			},
		],
		[
			"tmp",
			{
				label: "Temp",
				path: "screenshots/tmp",
				bytes: 0,
				clearable: true,
			},
		],
		[
			"screenshots_other",
			{
				label: "Screenshots (other)",
				path: "screenshots",
				bytes: 0,
				clearable: false,
			},
		],
		[
			"database",
			{
				label: "Database",
				path: "screencap.db*",
				bytes: 0,
				clearable: false,
			},
		],
		[
			"settings",
			{
				label: "Settings",
				path: "settings.json",
				bytes: 0,
				clearable: false,
			},
		],
	]);
}

function resolveCategoryKey(options: {
	screenshotsDir: string;
	originalsDir: string;
	thumbnailsDir: string;
	faviconsDir: string;
	appIconsDir: string;
	tempCapturesDir: string;
	dbPath: string;
	settingsPath: string;
	filePath: string;
}): string {
	const {
		screenshotsDir,
		originalsDir,
		thumbnailsDir,
		faviconsDir,
		appIconsDir,
		tempCapturesDir,
		dbPath,
		settingsPath,
		filePath,
	} = options;

	if (isSubpath(originalsDir, filePath)) return "originals";
	if (isSubpath(thumbnailsDir, filePath)) return "thumbnails";
	if (isSubpath(faviconsDir, filePath)) return "favicons";
	if (isSubpath(appIconsDir, filePath)) return "appicons";
	if (isSubpath(tempCapturesDir, filePath)) return "tmp";
	if (filePath === settingsPath) return "settings";
	if (filePath === dbPath || filePath.startsWith(`${dbPath}-`))
		return "database";
	if (isSubpath(screenshotsDir, filePath)) return "screenshots_other";
	return "other";
}

async function scanUserDataFiles(options: {
	userDataDir: string;
	onFile: (filePath: string, sizeBytes: number) => void;
}): Promise<number> {
	const stack: string[] = [options.userDataDir];
	let totalBytes = 0;

	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;

		let entries: Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}

		const nestedDirs: string[] = [];
		const filesToStat: string[] = [];

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				nestedDirs.push(fullPath);
				continue;
			}
			if (entry.isSymbolicLink()) continue;
			filesToStat.push(fullPath);
		}

		for (const nested of nestedDirs) {
			stack.push(nested);
		}

		const chunkSize = 32;
		for (let i = 0; i < filesToStat.length; i += chunkSize) {
			const chunk = filesToStat.slice(i, i + chunkSize);
			const stats = await Promise.all(
				chunk.map(async (p) => {
					try {
						return await lstat(p);
					} catch {
						return null;
					}
				}),
			);

			for (let j = 0; j < chunk.length; j += 1) {
				const stat = stats[j];
				const path = chunk[j];
				if (!stat || !path) continue;
				if (stat.isSymbolicLink()) continue;
				if (stat.isDirectory()) {
					stack.push(path);
					continue;
				}
				if (!stat.isFile()) continue;
				totalBytes += stat.size;
				options.onFile(path, stat.size);
			}
		}
	}

	return totalBytes;
}

export async function getStorageUsageBreakdown(): Promise<StorageUsageBreakdown> {
	const computedAt = Date.now();
	const userDataDir = resolve(app.getPath("userData"));
	const screenshotsDir = resolve(join(userDataDir, "screenshots"));
	const originalsDir = resolve(join(screenshotsDir, "originals"));
	const thumbnailsDir = resolve(join(screenshotsDir, "thumbnails"));
	const faviconsDir = resolve(join(screenshotsDir, "favicons"));
	const appIconsDir = resolve(join(screenshotsDir, "appicons"));
	const tempCapturesDir = resolve(join(screenshotsDir, "tmp"));
	const dbPath = resolve(join(userDataDir, "screencap.db"));
	const settingsPath = resolve(join(userDataDir, "settings.json"));

	const entriesMap = createEntriesMap();
	let otherBytes = 0;

	const totalBytes = await scanUserDataFiles({
		userDataDir,
		onFile: (filePath, sizeBytes) => {
			const key = resolveCategoryKey({
				screenshotsDir,
				originalsDir,
				thumbnailsDir,
				faviconsDir,
				appIconsDir,
				tempCapturesDir,
				dbPath,
				settingsPath,
				filePath,
			});

			if (key === "other") {
				otherBytes += sizeBytes;
				return;
			}

			const entry = entriesMap.get(key);
			if (!entry) {
				otherBytes += sizeBytes;
				return;
			}

			entry.bytes += sizeBytes;
		},
	});

	const entries: StorageUsageEntry[] = [
		...Array.from(entriesMap.entries()).map(([key, value]) => ({
			key,
			label: value.label,
			path: value.path,
			bytes: value.bytes,
			clearable: value.clearable,
		})),
		{
			key: "other",
			label: "Cache & other",
			path: ".",
			bytes: otherBytes,
			clearable: true,
		},
	].sort((a, b) => b.bytes - a.bytes);

	return { totalBytes, entries, computedAt };
}

export function getStorageCategoryPath(category: string): string | null {
	const userDataDir = resolve(app.getPath("userData"));
	const screenshotsDir = resolve(join(userDataDir, "screenshots"));

	const paths: Record<string, string> = {
		originals: resolve(join(screenshotsDir, "originals")),
		thumbnails: resolve(join(screenshotsDir, "thumbnails")),
		favicons: resolve(join(screenshotsDir, "favicons")),
		appicons: resolve(join(screenshotsDir, "appicons")),
		tmp: resolve(join(screenshotsDir, "tmp")),
		screenshots_other: screenshotsDir,
		database: resolve(join(userDataDir, "screencap.db")),
		settings: resolve(join(userDataDir, "settings.json")),
		other: userDataDir,
	};

	return paths[category] ?? null;
}

export async function clearStorageCategory(
	category: ClearableStorageCategory,
): Promise<{ clearedBytes: number }> {
	const userDataDir = resolve(app.getPath("userData"));
	const screenshotsDir = resolve(join(userDataDir, "screenshots"));

	const categoryPaths: Record<ClearableStorageCategory, string> = {
		tmp: resolve(join(screenshotsDir, "tmp")),
		thumbnails: resolve(join(screenshotsDir, "thumbnails")),
		favicons: resolve(join(screenshotsDir, "favicons")),
		appicons: resolve(join(screenshotsDir, "appicons")),
		other: userDataDir,
	};

	const targetPath = categoryPaths[category];
	if (!targetPath) return { clearedBytes: 0 };

	if (category === "other") {
		return clearOtherCategory(userDataDir, screenshotsDir);
	}

	let clearedBytes = 0;
	try {
		clearedBytes = await getDirSize(targetPath);
		await rm(targetPath, { recursive: true, force: true });
	} catch {
		clearedBytes = 0;
	}

	return { clearedBytes };
}

async function getDirSize(dirPath: string): Promise<number> {
	let total = 0;
	const stack = [dirPath];

	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;

		let entries: Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(fullPath);
			} else if (entry.isFile()) {
				try {
					const stat = await lstat(fullPath);
					total += stat.size;
				} catch {
					/* skip */
				}
			}
		}
	}
	return total;
}

async function clearOtherCategory(
	userDataDir: string,
	screenshotsDir: string,
): Promise<{ clearedBytes: number }> {
	const dbPath = resolve(join(userDataDir, "screencap.db"));
	const settingsPath = resolve(join(userDataDir, "settings.json"));

	const protectedPaths = new Set([
		screenshotsDir,
		dbPath,
		settingsPath,
		resolve(join(userDataDir, "screencap.db-shm")),
		resolve(join(userDataDir, "screencap.db-wal")),
	]);

	let clearedBytes = 0;
	let entries: Dirent[];
	try {
		entries = await readdir(userDataDir, { withFileTypes: true });
	} catch {
		return { clearedBytes: 0 };
	}

	for (const entry of entries) {
		const fullPath = resolve(join(userDataDir, entry.name));

		if (protectedPaths.has(fullPath)) continue;
		if (isSubpath(screenshotsDir, fullPath)) continue;
		if (fullPath.startsWith(`${dbPath}-`)) continue;

		try {
			if (entry.isDirectory()) {
				clearedBytes += await getDirSize(fullPath);
				await rm(fullPath, { recursive: true, force: true });
			} else if (entry.isFile()) {
				const stat = await lstat(fullPath);
				clearedBytes += stat.size;
				await rm(fullPath, { force: true });
			}
		} catch {
			/* skip */
		}
	}

	return { clearedBytes };
}
