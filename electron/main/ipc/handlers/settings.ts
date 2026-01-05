import { IpcChannels } from "../../../shared/ipc";
import type { Settings } from "../../../shared/types";
import { applyLaunchAtLoginSetting } from "../../app/loginItem";
import { triggerRetentionCleanupAfterSettingsChange } from "../../features/retention";
import { applyShortcuts } from "../../features/shortcuts";
import { getSettings, setSettings } from "../../infra/settings";
import { testBackendConnection } from "../../infra/settings/BackendConfig";
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
			applyShortcuts(settings);
			if (previous.retentionDays !== settings.retentionDays) {
				triggerRetentionCleanupAfterSettingsChange();
			}
			if (previous.launchAtLogin !== settings.launchAtLogin) {
				applyLaunchAtLoginSetting(settings.launchAtLogin);
			}
		},
	);

	secureHandle(
		IpcChannels.Settings.TestBackendConnection,
		ipcNoArgs,
		async () => {
			return testBackendConnection();
		},
	);
}
