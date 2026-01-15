import { once } from "node:events";
import { createWriteStream, type WriteStream, writeFileSync } from "node:fs";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	unlink,
	writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import { app, BrowserWindow, dialog } from "electron";
import { addLogObserver, type LogEntry } from "./logBuffer";

export interface CrashSessionLogSummary {
	id: string;
	createdAt: string;
	sizeBytes: number;
}

interface SessionState {
	startedAt: string;
	pid: number;
	cleanExit: boolean;
	endedAt: string | null;
	logFileName?: string;
}

const LEGACY_LOG_FILE_NAME = "current.log";
const STATE_FILE_NAME = "current-session.json";
const CRASH_DIR_NAME = "crash-sessions";
const MAX_CRASH_LOG_FILES = 10;

function sanitizeForFileName(value: string): string {
	return value
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function formatMainLogLine(entry: LogEntry): string {
	const dataStr =
		entry.data !== undefined ? ` ${JSON.stringify(entry.data, null, 2)}` : "";
	return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}${dataStr}`;
}

function formatRendererLogLine(params: {
	timestamp: string;
	level: string;
	windowKind: string;
	message: string;
}): string {
	return `[${params.timestamp}] [${params.level.toUpperCase()}] [Renderer/${params.windowKind}] ${params.message}`;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function readJsonFile<T>(path: string): Promise<T | null> {
	try {
		const raw = await readFile(path, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

class AsyncLineWriter {
	private readonly stream: WriteStream;
	private queue: string[] = [];
	private flushing = false;
	private closed = false;

	constructor(stream: WriteStream) {
		this.stream = stream;
		this.stream.on("error", () => {
			this.closed = true;
			this.queue = [];
		});
	}

	append(line: string): void {
		if (this.closed) return;
		this.queue.push(line.endsWith("\n") ? line : `${line}\n`);
		if (this.flushing) return;
		void this.flush();
	}

	end(): void {
		if (this.closed) return;
		this.closed = true;
		this.stream.end();
		this.queue = [];
	}

	private async flush(): Promise<void> {
		if (this.flushing || this.closed) return;
		this.flushing = true;
		try {
			while (!this.closed && this.queue.length > 0) {
				const chunk = this.queue.join("");
				this.queue = [];
				if (!this.stream.write(chunk)) {
					await once(this.stream, "drain");
				}
			}
		} finally {
			this.flushing = false;
		}
	}
}

let initialized = false;
let logsDirPath: string | null = null;
let statePath: string | null = null;
let crashDirPath: string | null = null;
let activeState: SessionState | null = null;
let writer: AsyncLineWriter | null = null;
let unsubscribeMainObserver: (() => void) | null = null;

function markCleanExit(): void {
	if (!activeState || !statePath) return;
	if (activeState.cleanExit) return;
	const endedAt = new Date().toISOString();
	activeState = { ...activeState, cleanExit: true, endedAt };
	try {
		writeFileSync(statePath, JSON.stringify(activeState), "utf-8");
	} catch {}
	writer?.append("");
	writer?.append("=".repeat(60));
	writer?.append(`SESSION END: ${endedAt}`);
	writer?.append("=".repeat(60));
	unsubscribeMainObserver?.();
	unsubscribeMainObserver = null;
	writer?.end();
	writer = null;
}

async function rotatePreviousLogIfNeeded(): Promise<void> {
	if (!logsDirPath || !statePath || !crashDirPath) return;

	const prevState = await readJsonFile<SessionState>(statePath);
	const prevLogPath = join(
		logsDirPath,
		prevState?.logFileName ?? LEGACY_LOG_FILE_NAME,
	);
	const legacyLogPath = join(logsDirPath, LEGACY_LOG_FILE_NAME);

	const pathToRotate = (await fileExists(prevLogPath))
		? prevLogPath
		: prevState
			? null
			: (await fileExists(legacyLogPath))
				? legacyLogPath
				: null;
	if (!pathToRotate) return;

	const prevStats = await stat(pathToRotate);
	if (prevStats.size === 0) {
		await unlink(pathToRotate).catch(() => {});
		return;
	}

	if (prevState?.cleanExit === true) {
		await unlink(pathToRotate).catch(() => {});
		return;
	}

	const kind = prevState?.cleanExit === false ? "crash" : "orphan";
	const startedAt = prevState?.startedAt ?? prevStats.mtime.toISOString();
	const pid = prevState?.pid ?? 0;
	const suffix = pid ? `-${pid}` : "";
	const baseName = `${kind}-${sanitizeForFileName(startedAt)}${suffix}`;
	const fileName = `${baseName}.log`;
	await mkdir(crashDirPath, { recursive: true });
	const destBase = join(crashDirPath, fileName);
	const destPath = (await fileExists(destBase))
		? join(crashDirPath, `${baseName}-${Date.now()}.log`)
		: destBase;
	await rename(pathToRotate, destPath).catch(() => {});
}

async function pruneCrashLogs(): Promise<void> {
	if (!crashDirPath) return;
	await mkdir(crashDirPath, { recursive: true });
	const entries = await readdir(crashDirPath, { withFileTypes: true });
	const logs = await Promise.all(
		entries
			.filter((e) => e.isFile() && e.name.endsWith(".log"))
			.map(async (e) => {
				const path = join(crashDirPath as string, e.name);
				const s = await stat(path);
				return { path, mtimeMs: s.mtimeMs };
			}),
	);
	logs.sort((a, b) => b.mtimeMs - a.mtimeMs);
	const toDelete = logs.slice(MAX_CRASH_LOG_FILES);
	await Promise.all(toDelete.map((e) => unlink(e.path).catch(() => {})));
}

export async function initSessionLogStore(): Promise<void> {
	if (initialized) return;
	initialized = true;

	const logsDir = join(app.getPath("userData"), "logs");
	crashDirPath = join(logsDir, CRASH_DIR_NAME);
	statePath = join(logsDir, STATE_FILE_NAME);
	logsDirPath = logsDir;

	await mkdir(logsDir, { recursive: true });
	await rotatePreviousLogIfNeeded();
	await pruneCrashLogs();

	const startedAt = new Date().toISOString();
	const logFileName = `session-${sanitizeForFileName(startedAt)}-${process.pid}.log`;
	activeState = {
		startedAt,
		pid: process.pid,
		cleanExit: false,
		endedAt: null,
		logFileName,
	};
	await writeFile(statePath, JSON.stringify(activeState), "utf-8").catch(
		() => {},
	);

	const stream = createWriteStream(join(logsDir, logFileName), { flags: "w" });
	writer = new AsyncLineWriter(stream);
	writer.append("=".repeat(60));
	writer.append("SCREENCAP SESSION LOG");
	writer.append(`Started: ${startedAt}`);
	writer.append(`App: ${app.getName()} v${app.getVersion()}`);
	writer.append(`Platform: ${process.platform} ${process.arch}`);
	writer.append(`PID: ${process.pid}`);
	writer.append("=".repeat(60));
	writer.append("");

	unsubscribeMainObserver = addLogObserver((entry) => {
		writer?.append(formatMainLogLine(entry));
	});

	app.on("before-quit", () => {
		markCleanExit();
	});
	process.on("exit", (code) => {
		if (code === 0) markCleanExit();
	});
}

export function appendRendererLogsToSession(
	entries: Array<{
		timestamp: string;
		level: string;
		windowKind: string;
		message: string;
	}>,
): void {
	for (const entry of entries) {
		writer?.append(formatRendererLogLine(entry));
	}
}

export async function listCrashSessionLogs(): Promise<
	CrashSessionLogSummary[]
> {
	const logsDir = join(app.getPath("userData"), "logs");
	const crashDir = join(logsDir, CRASH_DIR_NAME);
	await mkdir(crashDir, { recursive: true });
	const entries = await readdir(crashDir, { withFileTypes: true });
	const result = await Promise.all(
		entries
			.filter((e) => e.isFile() && e.name.endsWith(".log"))
			.map(async (e) => {
				const p = join(crashDir, e.name);
				const s = await stat(p);
				return {
					id: e.name,
					createdAt: s.birthtime.toISOString(),
					sizeBytes: s.size,
				} satisfies CrashSessionLogSummary;
			}),
	);
	result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	return result;
}

function assertSafeCrashLogId(id: string): string {
	const base = basename(id);
	if (base !== id) throw new Error("Invalid log id");
	if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error("Invalid log id");
	return id;
}

export async function saveCrashSessionLogToFile(
	id: string,
): Promise<string | null> {
	const safeId = assertSafeCrashLogId(id);
	const logsDir = join(app.getPath("userData"), "logs");
	const crashDir = join(logsDir, CRASH_DIR_NAME);
	const sourcePath = join(crashDir, safeId);
	if (!(await fileExists(sourcePath))) {
		throw new Error("Log not found");
	}

	const content = await readFile(sourcePath, "utf-8");
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const defaultPath = join(
		app.getPath("downloads"),
		`screencap-crash-logs-${safeId.replace(/\.log$/, "")}-${timestamp}.txt`,
	);

	const browserWindow = BrowserWindow.getFocusedWindow();
	const dialogResult = browserWindow
		? await dialog.showSaveDialog(browserWindow, {
				title: "Save Crash Session Logs",
				defaultPath,
				filters: [{ name: "Text Files", extensions: ["txt"] }],
			})
		: await dialog.showSaveDialog({
				title: "Save Crash Session Logs",
				defaultPath,
				filters: [{ name: "Text Files", extensions: ["txt"] }],
			});

	if (dialogResult.canceled || !dialogResult.filePath) {
		return null;
	}

	await writeFile(dialogResult.filePath, content, "utf-8");
	return dialogResult.filePath;
}
