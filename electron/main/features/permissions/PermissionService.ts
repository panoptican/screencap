import { shell, systemPreferences } from "electron";
import type { PermissionStatus } from "../../../shared/types";
import {
	getAutomationState,
	getChromiumAutomationState,
	getSafariAutomationState,
	getSpotifyAutomationState,
} from "../context";

export function checkScreenCapturePermission(): boolean {
	const status = systemPreferences.getMediaAccessStatus("screen");
	return status === "granted";
}

export function getScreenCaptureStatus(): PermissionStatus {
	const status = systemPreferences.getMediaAccessStatus("screen");
	if (status === "granted") return "granted";
	if (status === "denied") return "denied";
	return "not-determined";
}

export function openScreenCaptureSettings(): void {
	shell.openExternal(
		"x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
	);
}

export function checkAccessibilityPermission(): boolean {
	return systemPreferences.isTrustedAccessibilityClient(false);
}

export function requestAccessibilityPermission(): boolean {
	return systemPreferences.isTrustedAccessibilityClient(true);
}

export function getAccessibilityStatus(): PermissionStatus {
	const granted = systemPreferences.isTrustedAccessibilityClient(false);
	return granted ? "granted" : "not-determined";
}

export function openAccessibilitySettings(): void {
	shell.openExternal(
		"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
	);
}

export interface AutomationStatus {
	systemEvents: PermissionStatus;
	browsers: PermissionStatus;
	apps: PermissionStatus;
}

function mapAutomationState(
	state: "not-attempted" | "granted" | "denied",
): PermissionStatus {
	switch (state) {
		case "granted":
			return "granted";
		case "denied":
			return "denied";
		default:
			return "not-determined";
	}
}

export function getAutomationStatus(): AutomationStatus {
	const systemEventsState = getAutomationState();
	const safariState = getSafariAutomationState();
	const chromiumState = getChromiumAutomationState();
	const spotifyState = getSpotifyAutomationState();

	const systemEventsStatus = mapAutomationState(systemEventsState);

	const browserGranted =
		safariState === "granted" || chromiumState === "granted";
	const browserDenied = safariState === "denied" || chromiumState === "denied";
	const browserStatus: PermissionStatus = browserDenied
		? "denied"
		: browserGranted
			? "granted"
			: "not-determined";

	const appsStatus = mapAutomationState(spotifyState);

	return {
		systemEvents: systemEventsStatus,
		browsers: browserStatus,
		apps: appsStatus,
	};
}

export function openAutomationSettings(): void {
	shell.openExternal(
		"x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
	);
}
