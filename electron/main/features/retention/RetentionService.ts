import {
	deleteEvent,
	listExpiredEventIds,
} from "../../infra/db/repositories/EventRepository";
import { createLogger } from "../../infra/log";
import { getSettings } from "../../infra/settings";
import { broadcastEventsChanged } from "../../infra/windows";

const logger = createLogger({ scope: "Retention" });

const DAY_MS = 86_400_000;
const STARTUP_DELAY_MS = 5_000;
const RUN_INTERVAL_MS = 60 * 60 * 1000;
const MAX_RUN_TIME_MS = 1_500;
const BATCH_SIZE = 100;

type RetentionRunReason = "startup" | "interval" | "settings" | "manual";

let interval: NodeJS.Timeout | null = null;
let startupTimeout: NodeJS.Timeout | null = null;
let isRunning = false;
let rerunRequested = false;

function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

async function runRetentionCleanup(reason: RetentionRunReason): Promise<void> {
	if (isRunning) {
		rerunRequested = true;
		return;
	}

	isRunning = true;
	rerunRequested = false;

	try {
		const retentionDays = getSettings().retentionDays;
		const cutoff = Date.now() - retentionDays * DAY_MS;

		let deleted = 0;
		const startedAt = Date.now();

		for (;;) {
			const ids = listExpiredEventIds(cutoff, BATCH_SIZE);
			if (ids.length === 0) break;

			for (const id of ids) {
				deleteEvent(id);
				deleted += 1;
			}

			await yieldToEventLoop();

			if (Date.now() - startedAt >= MAX_RUN_TIME_MS) {
				rerunRequested = true;
				break;
			}
		}

		if (deleted > 0) {
			broadcastEventsChanged();
		}

		logger.info("Retention cleanup finished", {
			reason,
			retentionDays,
			cutoff,
			deleted,
		});
	} catch (error) {
		logger.error("Retention cleanup failed", { reason, error });
	} finally {
		isRunning = false;
		if (rerunRequested) {
			rerunRequested = false;
			void runRetentionCleanup("manual");
		}
	}
}

export function startRetentionService(): void {
	stopRetentionService();

	startupTimeout = setTimeout(() => {
		void runRetentionCleanup("startup");
	}, STARTUP_DELAY_MS);

	interval = setInterval(() => {
		void runRetentionCleanup("interval");
	}, RUN_INTERVAL_MS);
}

export function stopRetentionService(): void {
	if (startupTimeout) {
		clearTimeout(startupTimeout);
		startupTimeout = null;
	}

	if (interval) {
		clearInterval(interval);
		interval = null;
	}
}

export function triggerRetentionCleanup(): void {
	void runRetentionCleanup("manual");
}

export function triggerRetentionCleanupAfterSettingsChange(): void {
	void runRetentionCleanup("settings");
}
