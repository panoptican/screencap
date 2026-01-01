import { IpcChannels } from "../../../shared/ipc";
import type { Settings } from "../../../shared/types";
import { triggerRetentionCleanupAfterSettingsChange } from "../../features/retention";
import { getSettings, setSettings } from "../../infra/settings";
import { secureHandle } from "../secure";
import { ipcNoArgs, ipcSetSettingsArgs } from "../validation";

export function registerSettingsHandlers(): void {
	secureHandle(IpcChannels.Settings.Get, ipcNoArgs, () => {
		return getSettings();
	});

	secureHandle(
		IpcChannels.Settings.Set,
		ipcSetSettingsArgs,
		(settings: Settings) => {
			const previous = getSettings();
			setSettings(settings);
			if (previous.retentionDays !== settings.retentionDays) {
				triggerRetentionCleanupAfterSettingsChange();
			}
		},
	);
}
