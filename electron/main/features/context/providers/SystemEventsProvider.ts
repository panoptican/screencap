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

const COMBINED_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set bundleId to bundle identifier of frontApp
  set appPid to unix id of frontApp
  set winTitle to ""
  set winX to 0
  set winY to 0
  set winW to 0
  set winH to 0
  try
    set frontWin to first window of frontApp
    set winTitle to name of frontWin
    set winPos to position of frontWin
    set winSize to size of frontWin
    set winX to item 1 of winPos
    set winY to item 2 of winPos
    set winW to item 1 of winSize
    set winH to item 2 of winSize
  end try
  return appName & "|||" & bundleId & "|||" & appPid & "|||" & winTitle & "|||" & winX & "|||" & winY & "|||" & winW & "|||" & winH
end tell
`;

interface ParsedOutput {
	app: ForegroundApp;
	window: Omit<ForegroundWindow, "displayId" | "isFullscreen">;
}

function parseOutput(output: string): ParsedOutput | null {
	const parts = output.split("|||");
	if (parts.length < 8) return null;

	const pid = parseInt(parts[2], 10);
	if (Number.isNaN(pid)) return null;

	const x = parseInt(parts[4], 10) || 0;
	const y = parseInt(parts[5], 10) || 0;
	const width = parseInt(parts[6], 10) || 0;
	const height = parseInt(parts[7], 10) || 0;

	return {
		app: {
			name: parts[0],
			bundleId: parts[1],
			pid,
		},
		window: {
			title: parts[3] || "",
			bounds: { x, y, width, height },
		},
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
	const result = await runAppleScript(COMBINED_SCRIPT);

	if (!result.success) {
		if (isAutomationDenied(result.error)) {
			automationState = "denied";
			lastAutomationError = result.error;
			logger.warn("Automation permission denied for System Events");
		} else if (!result.timedOut) {
			logger.debug("Failed to get foreground snapshot", {
				error: result.error,
			});
		}
		return null;
	}

	const parsed = parseOutput(result.output);
	if (!parsed) {
		logger.debug("Failed to parse output", { output: result.output });
		return null;
	}

	const { displayId, isFullscreen } = findDisplayForWindow(
		parsed.window.bounds,
	);

	const window: ForegroundWindow = {
		...parsed.window,
		displayId,
		isFullscreen,
	};

	automationState = "granted";
	lastAutomationError = null;

	return {
		app: parsed.app,
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
