import type { BrowserWindow } from "electron";
import { createLogger } from "../infra/log";
import {
	registerAppHandlers,
	registerCaptureHandlers,
	registerLLMHandlers,
	registerPermissionHandlers,
	registerPopupHandlers,
	registerSchedulerHandlers,
	registerSettingsHandlers,
	registerStorageHandlers,
	registerUpdateHandlers,
	registerWindowHandlers,
} from "./handlers";

const logger = createLogger({ scope: "IPC" });

let registered = false;

export function registerAllHandlers(
	getMainWindow: () => BrowserWindow | null,
): void {
	if (registered) {
		logger.warn("IPC handlers already registered, skipping");
		return;
	}

	logger.info("Registering IPC handlers");

	registerAppHandlers();
	registerWindowHandlers(getMainWindow);
	registerPermissionHandlers();
	registerCaptureHandlers();
	registerSchedulerHandlers();
	registerStorageHandlers();
	registerSettingsHandlers();
	registerLLMHandlers();
	registerPopupHandlers();
	registerUpdateHandlers();

	registered = true;
	logger.info("IPC handlers registered");
}
