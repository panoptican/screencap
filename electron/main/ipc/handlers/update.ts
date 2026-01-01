import { IpcChannels } from "../../../shared/ipc";
import {
	checkForUpdates,
	downloadUpdate,
	getUpdateState,
	restartAndInstall,
} from "../../features/update";
import { secureHandle } from "../secure";
import { ipcNoArgs } from "../validation";

export function registerUpdateHandlers(): void {
	secureHandle(IpcChannels.Update.GetState, ipcNoArgs, () => {
		return getUpdateState();
	});

	secureHandle(IpcChannels.Update.Check, ipcNoArgs, () => {
		checkForUpdates();
	});

	secureHandle(IpcChannels.Update.Download, ipcNoArgs, () => {
		downloadUpdate();
	});

	secureHandle(IpcChannels.Update.RestartAndInstall, ipcNoArgs, () => {
		restartAndInstall();
	});
}
