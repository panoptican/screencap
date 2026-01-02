import { BrowserWindow, type Rectangle, screen } from "electron";
import { IpcChannels } from "../../../shared/ipc";
import {
	getCapturePopupWindow,
	openProjectProgressCapture,
	setCapturePopupHeight,
} from "../../app/capturePopup";
import { getPopupWindow, setPopupHeight } from "../../app/popup";
import { triggerManualCaptureWithPrimaryDisplay } from "../../features/scheduler";
import { secureHandleWithEvent } from "../secure";
import { ipcNoArgs, ipcSetPopupHeightArgs } from "../validation";

function cursorAnchor(): Rectangle {
	const p = screen.getCursorScreenPoint();
	return { x: p.x, y: p.y, width: 1, height: 1 };
}

function displayIdForWindow(win: BrowserWindow): string {
	const bounds = win.getBounds();
	const point = {
		x: Math.round(bounds.x + bounds.width / 2),
		y: Math.round(bounds.y + bounds.height / 2),
	};
	return String(screen.getDisplayNearestPoint(point).id);
}

async function sleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function registerPopupHandlers(): void {
	secureHandleWithEvent(
		IpcChannels.Popup.SetHeight,
		ipcSetPopupHeightArgs,
		(event, height) => {
			const senderWindow = BrowserWindow.fromWebContents(event.sender);
			if (!senderWindow || senderWindow.isDestroyed()) return;
			const trayPopup = getPopupWindow();
			if (
				trayPopup &&
				!trayPopup.isDestroyed() &&
				trayPopup.id === senderWindow.id
			) {
				setPopupHeight(height);
				return;
			}
			const capturePopup = getCapturePopupWindow();
			if (
				capturePopup &&
				!capturePopup.isDestroyed() &&
				capturePopup.id === senderWindow.id
			) {
				setCapturePopupHeight(height);
			}
		},
	);

	secureHandleWithEvent(
		IpcChannels.Popup.StartProjectProgressCapture,
		ipcNoArgs,
		async (event) => {
			const senderWindow = BrowserWindow.fromWebContents(event.sender);
			const anchor = senderWindow?.getBounds() ?? cursorAnchor();
			const primaryDisplayId =
				senderWindow && !senderWindow.isDestroyed()
					? displayIdForWindow(senderWindow)
					: String(screen.getPrimaryDisplay().id);

			if (
				senderWindow &&
				!senderWindow.isDestroyed() &&
				senderWindow.isVisible()
			) {
				senderWindow.hide();
				await sleep(160);
			}

			const result = await triggerManualCaptureWithPrimaryDisplay({
				primaryDisplayId,
				intent: "project_progress",
			});

			if (!result.eventId) return;
			await openProjectProgressCapture({ eventId: result.eventId, anchor });
		},
	);
}
