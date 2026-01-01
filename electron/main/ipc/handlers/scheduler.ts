import { IpcChannels } from "../../../shared/ipc";
import {
	isSchedulerRunning,
	startScheduler,
	stopScheduler,
} from "../../features/scheduler";
import { createLogger } from "../../infra/log";
import { secureHandle } from "../secure";
import { ipcNoArgs, ipcStartSchedulerArgs } from "../validation";

const logger = createLogger({ scope: "SchedulerIPC" });

export function registerSchedulerHandlers(): void {
	secureHandle(
		IpcChannels.Scheduler.Start,
		ipcStartSchedulerArgs,
		(intervalMinutes?: number) => {
			logger.info("Starting scheduler via IPC", { intervalMinutes });
			startScheduler(intervalMinutes);
		},
	);

	secureHandle(IpcChannels.Scheduler.Stop, ipcNoArgs, () => {
		logger.info("Stopping scheduler via IPC");
		stopScheduler();
	});

	secureHandle(IpcChannels.Scheduler.IsRunning, ipcNoArgs, () => {
		return isSchedulerRunning();
	});
}
