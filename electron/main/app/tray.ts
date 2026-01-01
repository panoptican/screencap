import { app, Menu, nativeImage, screen, Tray } from "electron";
import {
	startScheduler,
	stopScheduler,
	triggerManualCaptureWithPrimaryDisplay,
} from "../features/scheduler";
import { createLogger } from "../infra/log";
import { togglePopupWindow } from "./popup";
import { destroyMainWindow, showMainWindow } from "./window";

let tray: Tray | null = null;
let trayMenu: Menu | null = null;
let quitCallback: (() => void) | null = null;

const logger = createLogger({ scope: "Tray" });

const TRAY_ICON_PNG_16_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWElEQVR4nGNgGHbgP5EYrwEHGBgYGnDgA8QY0IBHvoEUA5gYGBhioJiRHANikPwcTawByACbASQBRqjGKCQv0B4cYGBgWIAnGhdA1dA2ITXgkScpGuljAAC1kjj7fhZmwQAAAABJRU5ErkJggg==";

const TRAY_ICON_PNG_32_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbElEQVR4nO3VMQqAMAxG4Td5deM9bT1GXDpGRVtCwf9Bl0LKNwQKSqnrfPB5nQtAx/CIN1wAJgYswAZUoADW7tIAFmy5ZQJqADhGA+4qAWAnMQsAayZgaYjysIRKdeUzfcf+e8DXBHABmB1wAnen4K7QJiaHAAAAAElFTkSuQmCC";

function createTrayIcon(): Electron.NativeImage {
	const buffer1x = Buffer.from(TRAY_ICON_PNG_16_BASE64, "base64");
	const buffer2x = Buffer.from(TRAY_ICON_PNG_32_BASE64, "base64");
	const image1x = nativeImage.createFromBuffer(buffer1x, { scaleFactor: 1 });
	const image2x = nativeImage.createFromBuffer(buffer2x, { scaleFactor: 2 });

	const icon = nativeImage.createEmpty();
	icon.addRepresentation({ scaleFactor: 1, buffer: image1x.toPNG() });
	icon.addRepresentation({ scaleFactor: 2, buffer: image2x.toPNG() });

	if (process.platform === "darwin") {
		icon.setTemplateImage(true);
	}

	logger.info("Tray icon created", {
		isEmpty: icon.isEmpty(),
		size: icon.getSize(),
		platform: process.platform,
	});

	return icon;
}

function updateTrayMenu(isPaused: boolean): void {
	if (!trayMenu) return;

	const pauseItem = trayMenu.getMenuItemById("pause");
	const resumeItem = trayMenu.getMenuItemById("resume");
	if (pauseItem) pauseItem.visible = !isPaused;
	if (resumeItem) resumeItem.visible = isPaused;
}

function getTrayDisplayId(): string {
	const bounds = tray?.getBounds();
	if (!bounds) return String(screen.getPrimaryDisplay().id);
	const point = {
		x: Math.round(bounds.x + bounds.width / 2),
		y: Math.round(bounds.y + bounds.height / 2),
	};
	return String(screen.getDisplayNearestPoint(point).id);
}

export function createTray(onQuit: () => void): Tray {
	quitCallback = onQuit;

	logger.info("Creating tray...");

	let icon: Electron.NativeImage | null = null;
	try {
		icon = createTrayIcon();
		tray = new Tray(icon);
	} catch (error) {
		logger.error("Failed to create tray", error);
		throw error;
	}

	tray.setToolTip("Screencap");

	if (
		process.platform === "darwin" &&
		process.env.NODE_ENV === "development" &&
		icon?.isEmpty()
	) {
		tray.setTitle("SC");
	}

	logger.info("Tray created", { platform: process.platform });

	trayMenu = Menu.buildFromTemplate([
		{
			label: "Open Screencap",
			click: () => showMainWindow(),
		},
		{ type: "separator" },
		{
			label: "Capture Now",
			click: () => {
				void triggerManualCaptureWithPrimaryDisplay({
					primaryDisplayId: getTrayDisplayId(),
				});
			},
		},
		{
			label: "Pause Capture",
			id: "pause",
			click: () => {
				stopScheduler();
				updateTrayMenu(true);
			},
		},
		{
			label: "Resume Capture",
			id: "resume",
			visible: false,
			click: () => {
				startScheduler();
				updateTrayMenu(false);
			},
		},
		{ type: "separator" },
		{
			label: "Quit",
			click: () => {
				quitCallback?.();
				destroyMainWindow();
				app.quit();
			},
		},
	]);

	tray.on("click", (_event, bounds) => {
		togglePopupWindow(bounds ?? tray?.getBounds());
	});

	tray.on("right-click", () => {
		tray?.popUpContextMenu(trayMenu ?? undefined);
	});

	return tray;
}

export function destroyTray(): void {
	tray?.destroy();
	tray = null;
	trayMenu = null;
}
