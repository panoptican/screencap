import { screen } from "electron";
import { createLogger } from "../../../infra/log";
import { isAutomationDenied, runAppleScript } from "../applescript";
import type {
	ForegroundApp,
	ForegroundSnapshot,
	ForegroundWindow,
	WindowBounds,
} from "../types";

const logger = createLogger({ scope: "SystemEventsProvider" });

const FRONTMOST_APP_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set bundleId to bundle identifier of frontApp
  set appPid to unix id of frontApp
  return appName & "|||" & bundleId & "|||" & appPid
end tell
`;

const FRONT_WINDOW_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  try
    set frontWin to first window of frontApp
    set winTitle to name of frontWin
    set winPos to position of frontWin
    set winSize to size of frontWin
    return winTitle & "|||" & (item 1 of winPos) & "|||" & (item 2 of winPos) & "|||" & (item 1 of winSize) & "|||" & (item 2 of winSize)
  on error
    return "|||0|||0|||0|||0"
  end try
end tell
`;

function parseAppOutput(output: string): ForegroundApp | null {
	const parts = output.split("|||");
	if (parts.length < 3) return null;

	const pid = parseInt(parts[2], 10);
	if (Number.isNaN(pid)) return null;

	return {
		name: parts[0],
		bundleId: parts[1],
		pid,
	};
}

function parseWindowOutput(
	output: string,
): Omit<ForegroundWindow, "displayId" | "isFullscreen"> | null {
	const parts = output.split("|||");
	if (parts.length < 5) return null;

	const x = parseInt(parts[1], 10);
	const y = parseInt(parts[2], 10);
	const width = parseInt(parts[3], 10);
	const height = parseInt(parts[4], 10);

	if ([x, y, width, height].some(Number.isNaN)) return null;

	return {
		title: parts[0],
		bounds: { x, y, width, height },
	};
}

function findDisplayForWindow(bounds: WindowBounds): {
	displayId: string;
	isFullscreen: boolean;
} {
	const displays = screen.getAllDisplays();

	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;

	let matchedDisplay = displays[0];
	for (const display of displays) {
		const db = display.bounds;
		if (
			centerX >= db.x &&
			centerX < db.x + db.width &&
			centerY >= db.y &&
			centerY < db.y + db.height
		) {
			matchedDisplay = display;
			break;
		}
	}

	const displayId = String(matchedDisplay.id);
	const db = matchedDisplay.bounds;
	const wa = matchedDisplay.workArea;

	const matchesBounds =
		Math.abs(bounds.x - db.x) <= 5 &&
		Math.abs(bounds.y - db.y) <= 30 &&
		Math.abs(bounds.width - db.width) <= 5 &&
		Math.abs(bounds.height - db.height) <= 30;

	const matchesWorkArea =
		Math.abs(bounds.x - wa.x) <= 5 &&
		Math.abs(bounds.y - wa.y) <= 5 &&
		Math.abs(bounds.width - wa.width) <= 5 &&
		Math.abs(bounds.height - wa.height) <= 5;

	const isFullscreen = matchesBounds || matchesWorkArea;

	return { displayId, isFullscreen };
}

type AutomationState = "not-attempted" | "granted" | "denied";

let automationState: AutomationState = "not-attempted";
let lastAutomationError: string | null = null;

export async function collectForegroundSnapshot(): Promise<ForegroundSnapshot | null> {
	const [appResult, windowResult] = await Promise.all([
		runAppleScript(FRONTMOST_APP_SCRIPT),
		runAppleScript(FRONT_WINDOW_SCRIPT),
	]);

	if (!appResult.success) {
		if (isAutomationDenied(appResult.error)) {
			automationState = "denied";
			lastAutomationError = appResult.error;
			logger.warn("Automation permission denied for System Events");
		} else {
			logger.debug("Failed to get frontmost app", { error: appResult.error });
		}
		return null;
	}

	const app = parseAppOutput(appResult.output);
	if (!app) {
		logger.debug("Failed to parse app output", { output: appResult.output });
		return null;
	}

	let windowData: Omit<ForegroundWindow, "displayId" | "isFullscreen"> = {
		title: "",
		bounds: { x: 0, y: 0, width: 0, height: 0 },
	};

	if (windowResult.success) {
		const parsed = parseWindowOutput(windowResult.output);
		if (parsed) {
			windowData = parsed;
		}
	}

	const { displayId, isFullscreen } = findDisplayForWindow(windowData.bounds);

	const window: ForegroundWindow = {
		...windowData,
		displayId,
		isFullscreen,
	};

	automationState = "granted";
	lastAutomationError = null;

	return {
		app,
		window,
		capturedAt: Date.now(),
	};
}

export function getLastAutomationError(): string | null {
	return lastAutomationError;
}

export function getAutomationState(): AutomationState {
	return automationState;
}
