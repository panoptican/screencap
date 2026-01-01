import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, shell } from "electron";
import { setTrustedWebContentsIds } from "../ipc/secure";

let mainWindow: BrowserWindow | null = null;

function setMacActivationMode(mode: "foreground" | "background"): void {
	if (process.platform !== "darwin") return;

	if (mode === "foreground") {
		try {
			void app.dock.show().catch(() => {});
		} catch {}
		try {
			app.setActivationPolicy("regular");
		} catch {}
		app.show();
		app.focus({ steal: true });
		return;
	}

	try {
		app.dock.hide();
	} catch {}
	try {
		app.setActivationPolicy("accessory");
	} catch {}
}

function getAppOrigin(): string | null {
	const devUrl = process.env.ELECTRON_RENDERER_URL;
	if (!devUrl) return null;
	try {
		return new URL(devUrl).origin;
	} catch {
		return null;
	}
}

function isAppNavigationUrl(url: string): boolean {
	try {
		const u = new URL(url);
		const appOrigin = getAppOrigin();
		if (appOrigin) return u.origin === appOrigin;

		const appFileUrl = pathToFileURL(join(__dirname, "../renderer/index.html"));
		return u.protocol === "file:" && u.pathname === appFileUrl.pathname;
	} catch {
		return false;
	}
}

function openExternalUrl(url: string): void {
	try {
		const u = new URL(url);
		if (u.protocol !== "http:" && u.protocol !== "https:") return;
		void shell.openExternal(u.toString(), { activate: true });
	} catch {
		return;
	}
}

export function createWindow(): BrowserWindow {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		show: false,
		titleBarStyle: "hiddenInset",
		trafficLightPosition: { x: 7, y: 13 },
		backgroundColor: "#0E0E0E",
		webPreferences: {
			preload: join(__dirname, "../preload/index.cjs"),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: true,
			webviewTag: false,
		},
	});

	setTrustedWebContentsIds([mainWindow.webContents.id]);

	mainWindow.webContents.on("will-navigate", (event, url) => {
		if (isAppNavigationUrl(url)) return;
		event.preventDefault();
		openExternalUrl(url);
	});

	mainWindow.webContents.on("will-redirect", (event, url) => {
		if (isAppNavigationUrl(url)) return;
		event.preventDefault();
		openExternalUrl(url);
	});

	mainWindow.webContents.on("did-attach-webview", (event) => {
		event.preventDefault();
	});

	const session = mainWindow.webContents.session;
	session.setPermissionCheckHandler(() => false);
	session.setPermissionRequestHandler((_webContents, _permission, callback) =>
		callback(false),
	);

	mainWindow.on("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.webContents.setWindowOpenHandler((details) => {
		openExternalUrl(details.url);
		return { action: "deny" };
	});

	if (process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}

	return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
	return mainWindow;
}

export function showMainWindow(): void {
	const win = mainWindow;
	if (!win || win.isDestroyed()) return;

	setMacActivationMode("foreground");

	if (win.isMinimized()) {
		win.restore();
	}

	win.show();
	win.moveTop();
	win.focus();
}

export function hideMainWindow(): void {
	const win = mainWindow;
	if (!win || win.isDestroyed()) return;
	win.hide();
	setMacActivationMode("background");
}

export function destroyMainWindow(): void {
	mainWindow?.destroy();
	mainWindow = null;
}

export function setupWindowCloseHandler(isQuitting: () => boolean): void {
	mainWindow?.on("close", (event) => {
		if (!isQuitting()) {
			event.preventDefault();
			hideMainWindow();
		}
	});
}
