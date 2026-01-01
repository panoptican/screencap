import { IpcChannels } from "../../../shared/ipc";
import { setPopupHeight } from "../../app/popup";
import { secureHandle } from "../secure";
import { ipcSetPopupHeightArgs } from "../validation";

export function registerPopupHandlers(): void {
	secureHandle(IpcChannels.Popup.SetHeight, ipcSetPopupHeightArgs, (height) => {
		setPopupHeight(height);
	});
}
