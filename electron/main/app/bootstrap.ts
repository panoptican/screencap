import { app } from "electron";
import { checkScreenCapturePermission } from "../features/permissions";
import { startQueueProcessor } from "../features/queue";
import { startRetentionService } from "../features/retention";
import { startScheduler } from "../features/scheduler";
import { initializeUpdater } from "../features/update";
import { createLogger } from "../infra/log";
import { registerAllHandlers } from "../ipc";
import { initializeDatabase } from "./database";
import {
	getIsQuitting,
	setIsQuitting,
	setupLifecycleHandlers,
} from "./lifecycle";
import { registerProtocols } from "./protocol";
import { createTray } from "./tray";
import { createWindow, getMainWindow, setupWindowCloseHandler } from "./window";

const logger = createLogger({ scope: "App" });

export async function bootstrap(): Promise<void> {
	await app.whenReady();

	logger.info("App starting...");

	registerProtocols();
	initializeDatabase();

	registerAllHandlers(getMainWindow);

	const hasPermission = checkScreenCapturePermission();
	logger.info("Screen capture permission:", hasPermission);

	const _mainWindow = createWindow();
	setupWindowCloseHandler(getIsQuitting);

	createTray(() => setIsQuitting(true));

	startRetentionService();
	startQueueProcessor();

	if (hasPermission) {
		startScheduler();
	}

	initializeUpdater();

	setupLifecycleHandlers();

	logger.info("App ready");
}
