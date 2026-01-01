import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, type Rectangle, screen } from "electron";
import {
	addTrustedWebContentsId,
	removeTrustedWebContentsId,
} from "../ipc/secure";

let popupWindow: BrowserWindow | null = null;

const POPUP_WIDTH = 420;
const POPUP_DEFAULT_HEIGHT = 330;
const POPUP_MIN_HEIGHT = 240;
const POPUP_MAX_HEIGHT = 1200;
const POPUP_MARGIN = 8;

let popupHeight = POPUP_DEFAULT_HEIGHT;
let lastAnchor: Rectangle | undefined;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function computePopupPosition(anchor?: Rectangle): { x: number; y: number } {
	const display = anchor
		? screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y })
		: screen.getPrimaryDisplay();

	const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
	const minX = wx + POPUP_MARGIN;
	const maxX = wx + ww - POPUP_WIDTH - POPUP_MARGIN;
	const minY = wy + POPUP_MARGIN;
	const maxY = wy + wh - popupHeight - POPUP_MARGIN;

	if (!anchor) {
		return { x: maxX, y: minY };
	}

	const desiredX = Math.round(anchor.x + anchor.width / 2 - POPUP_WIDTH / 2);
	const desiredY = Math.round(anchor.y + anchor.height + POPUP_MARGIN);

	return {
		x: clamp(desiredX, minX, maxX),
		y: clamp(desiredY, minY, maxY),
	};
}

function positionPopupWindow(anchor?: Rectangle): void {
	if (!popupWindow || popupWindow.isDestroyed()) return;
	const { x, y } = computePopupPosition(anchor);
	popupWindow.setBounds(
		{ x, y, width: POPUP_WIDTH, height: popupHeight },
		false,
	);
}

export function createPopupWindow(anchor?: Rectangle): BrowserWindow {
	if (popupWindow && !popupWindow.isDestroyed()) {
		return popupWindow;
	}

	lastAnchor = anchor;
	const { x, y } = computePopupPosition(anchor);

	popupWindow = new BrowserWindow({
		width: POPUP_WIDTH,
		height: popupHeight,
		x,
		y,
		show: false,
		acceptFirstMouse: true,
		frame: false,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		closable: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		transparent: true,
		hasShadow: true,
		vibrancy: "under-window",
		visualEffectState: "active",
		webPreferences: {
			preload: join(__dirname, "../preload/index.cjs"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	if (process.platform === "darwin") {
		popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
		popupWindow.setAlwaysOnTop(true, "pop-up-menu");
	}

	const webContentsId = popupWindow.webContents.id;
	addTrustedWebContentsId(webContentsId);

	popupWindow.on("blur", () => {
		setTimeout(() => {
			if (!popupWindow || popupWindow.isDestroyed()) return;
			if (popupWindow.isFocused()) return;
			hidePopupWindow();
		}, 0);
	});

	popupWindow.on("closed", () => {
		removeTrustedWebContentsId(webContentsId);
		popupWindow = null;
	});

	const url = process.env.ELECTRON_RENDERER_URL
		? `${process.env.ELECTRON_RENDERER_URL}#popup`
		: pathToFileURL(join(__dirname, "../renderer/index.html")).toString() +
			"#popup";

	popupWindow.loadURL(url);

	return popupWindow;
}

export function showPopupWindow(anchor?: Rectangle): void {
	lastAnchor = anchor;
	if (!popupWindow || popupWindow.isDestroyed()) {
		createPopupWindow(anchor);
	}
	positionPopupWindow(anchor);
	if (!popupWindow || popupWindow.isDestroyed()) return;
	popupWindow.show();
	popupWindow.focus();
}

export function hidePopupWindow(): void {
	if (!popupWindow || popupWindow.isDestroyed()) return;
	popupWindow.hide();
}

export function togglePopupWindow(anchor?: Rectangle): void {
	lastAnchor = anchor;
	if (!popupWindow || popupWindow.isDestroyed()) {
		createPopupWindow(anchor);
		positionPopupWindow(anchor);
		if (!popupWindow || popupWindow.isDestroyed()) return;
		popupWindow.show();
		popupWindow.focus();
		return;
	}

	if (popupWindow.isDestroyed()) return;

	if (popupWindow.isVisible()) {
		popupWindow.hide();
	} else {
		positionPopupWindow(anchor);
		if (popupWindow.isDestroyed()) return;
		popupWindow.show();
		popupWindow.focus();
	}
}

export function destroyPopupWindow(): void {
	if (!popupWindow || popupWindow.isDestroyed()) {
		popupWindow = null;
		return;
	}
	popupWindow.destroy();
	popupWindow = null;
}

export function setPopupHeight(height: number): void {
	if (!popupWindow || popupWindow.isDestroyed()) return;
	const anchor = lastAnchor;
	const display = anchor
		? screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y })
		: screen.getPrimaryDisplay();
	const maxByDisplay = Math.max(0, display.workArea.height - POPUP_MARGIN * 2);
	const safeMax = Math.min(POPUP_MAX_HEIGHT, maxByDisplay);
	const safeMin = Math.min(POPUP_MIN_HEIGHT, safeMax);
	popupHeight = clamp(Math.round(height), safeMin, safeMax);
	positionPopupWindow(anchor);
}
