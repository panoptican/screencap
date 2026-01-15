interface RendererLogEntry {
	timestamp: string;
	level: string;
	message: string;
	data?: unknown;
}

type RendererLogForwardEntry = {
	timestamp: string;
	level: string;
	windowKind: string;
	message: string;
};

const MAX_BUFFER_SIZE = 500;
const logBuffer: RendererLogEntry[] = [];
const forwardQueue: RendererLogForwardEntry[] = [];
let forwardTimer: number | null = null;
let flushingForwardQueue = false;

function getWindowKind(): string {
	const hash = window.location.hash;
	if (hash === "#popup") return "streak";
	if (hash.startsWith("#popup-capture")) return "capture";
	return "main";
}

const windowKind = getWindowKind();

const originalConsole = {
	log: console.log.bind(console),
	info: console.info.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
};

function canForward(): boolean {
	return Boolean(window.api?.logs?.appendRendererLogs);
}

async function flushRendererLogsToMain(): Promise<void> {
	if (flushingForwardQueue) return;
	if (!canForward()) return;
	if (forwardQueue.length === 0) return;
	flushingForwardQueue = true;
	try {
		const batch = forwardQueue.splice(0, Math.min(200, forwardQueue.length));
		if (batch.length === 0) return;
		await window.api.logs.appendRendererLogs(batch);
	} catch {
	} finally {
		flushingForwardQueue = false;
		if (forwardQueue.length > 0) {
			void flushRendererLogsToMain();
		}
	}
}

function scheduleForwardFlush(): void {
	if (forwardTimer !== null) return;
	forwardTimer = window.setTimeout(() => {
		forwardTimer = null;
		void flushRendererLogsToMain();
	}, 750);
}

function appendLog(level: string, args: unknown[]): void {
	const message = args
		.map((arg) =>
			typeof arg === "string" ? arg : JSON.stringify(arg, null, 2),
		)
		.join(" ");

	const timestamp = new Date().toISOString();
	logBuffer.push({
		timestamp,
		level,
		message,
	});

	forwardQueue.push({ timestamp, level, windowKind, message });
	if (forwardQueue.length >= 200) {
		void flushRendererLogsToMain();
	} else {
		scheduleForwardFlush();
	}

	if (logBuffer.length > MAX_BUFFER_SIZE) {
		logBuffer.shift();
	}
}

export function initRendererLogCapture(): void {
	window.addEventListener("beforeunload", () => {
		void flushRendererLogsToMain();
	});
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			void flushRendererLogsToMain();
		}
	});

	console.log = (...args: unknown[]) => {
		appendLog("log", args);
		originalConsole.log(...args);
	};

	console.info = (...args: unknown[]) => {
		appendLog("info", args);
		originalConsole.info(...args);
	};

	console.warn = (...args: unknown[]) => {
		appendLog("warn", args);
		originalConsole.warn(...args);
	};

	console.error = (...args: unknown[]) => {
		appendLog("error", args);
		originalConsole.error(...args);
	};
}

export function getRendererLogs(): string {
	return logBuffer
		.map(
			(entry) =>
				`[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`,
		)
		.join("\n");
}

export function getRendererLogCount(): number {
	return logBuffer.length;
}
