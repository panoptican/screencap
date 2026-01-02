import { IpcChannels } from "../../../shared/ipc";
import { setShortcutsSuspended } from "../../features/shortcuts";
import { secureHandle } from "../secure";
import { ipcSetShortcutsSuspendedArgs } from "../validation";

export function registerShortcutsHandlers(): void {
	secureHandle(
		IpcChannels.Shortcuts.SetSuspended,
		ipcSetShortcutsSuspendedArgs,
		(suspended: boolean) => {
			setShortcutsSuspended(suspended);
		},
	);
}
