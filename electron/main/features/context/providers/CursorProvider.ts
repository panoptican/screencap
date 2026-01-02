import { createLogger } from "../../../infra/log";
import { runAppleScript } from "../applescript";
import type {
	ContentDescriptor,
	ContextEnrichment,
	ForegroundSnapshot,
} from "../types";
import type { ContextProvider } from "./types";

const logger = createLogger({ scope: "CursorProvider" });

const CURSOR_BUNDLE_IDS = new Set([
	"com.todesktop.230313mzl4w4u92",
	"com.microsoft.VSCode",
	"com.microsoft.VSCodeInsiders",
	"com.visualstudio.code.oss",
	"com.vscodium",
]);

async function getWindowTitleViaAccessibility(
	bundleId: string,
): Promise<string | null> {
	const script = `
tell application "System Events"
  try
    set targetProc to first application process whose bundle identifier is "${bundleId}" and visible is true
    set allWins to every window of targetProc
    if (count of allWins) > 0 then
      repeat with w in allWins
        set winTitle to title of w
        if winTitle is not "" and winTitle is not missing value then
          return winTitle
        end if
      end repeat
    end if
    return ""
  on error errMsg
    return "ERR:" & errMsg
  end try
end tell
`;

	const result = await runAppleScript(script);
	logger.debug("Accessibility AppleScript result", {
		bundleId,
		success: result.success,
		output: result.output,
		error: result.error,
	});
	if (
		result.success &&
		result.output.trim() &&
		!result.output.startsWith("ERR:")
	) {
		return result.output.trim();
	}
	return null;
}

function parseWorkspaceFromTitle(title: string): string | null {
	if (!title || title.length === 0) return null;

	const emDashParts = title.split(" — ");
	if (emDashParts.length >= 2) {
		const workspace = emDashParts[emDashParts.length - 1].trim();
		if (
			workspace &&
			!workspace.includes(".") &&
			workspace !== "Untitled (Workspace)"
		) {
			return workspace;
		}
		if (emDashParts.length >= 2) {
			const maybeWorkspace = emDashParts[1]?.trim();
			if (maybeWorkspace && maybeWorkspace !== "Untitled (Workspace)") {
				return maybeWorkspace.replace(/ — .*$/, "").trim();
			}
		}
	}

	const dashParts = title.split(" - ");
	if (dashParts.length >= 2) {
		for (let i = dashParts.length - 1; i >= 1; i--) {
			const part = dashParts[i].trim();
			if (
				part &&
				!part.includes(".") &&
				part !== "Cursor" &&
				part !== "Visual Studio Code" &&
				part !== "VSCode" &&
				part !== "Code"
			) {
				return part;
			}
		}
		const maybeWorkspace = dashParts[1]?.trim();
		if (
			maybeWorkspace &&
			maybeWorkspace !== "Cursor" &&
			maybeWorkspace !== "Visual Studio Code"
		) {
			return maybeWorkspace;
		}
	}

	return null;
}

function parseFileFromTitle(title: string): string | null {
	if (!title || title.length === 0) return null;

	const emDashParts = title.split(" — ");
	if (emDashParts.length >= 1) {
		const filename = emDashParts[0]?.trim();
		if (filename?.includes(".")) {
			return filename.replace(/^●\s*/, "").trim();
		}
	}

	const dashParts = title.split(" - ");
	if (dashParts.length >= 1) {
		const filename = dashParts[0]?.trim();
		if (filename?.includes(".")) {
			return filename.replace(/^●\s*/, "").trim();
		}
	}

	return null;
}

export const cursorProvider: ContextProvider = {
	id: "cursor",
	priority: 50,

	supports(snapshot: ForegroundSnapshot): boolean {
		return CURSOR_BUNDLE_IDS.has(snapshot.app.bundleId);
	},

	async collect(
		snapshot: ForegroundSnapshot,
	): Promise<ContextEnrichment | null> {
		let title = snapshot.window.title;

		if (!title || title.length === 0) {
			const accessibilityTitle = await getWindowTitleViaAccessibility(
				snapshot.app.bundleId,
			);
			if (accessibilityTitle) {
				title = accessibilityTitle;
				logger.debug("Got window title via Accessibility API", { title });
			}
		}

		const workspace = parseWorkspaceFromTitle(title);
		const filename = parseFileFromTitle(title);

		logger.debug("Parsing window title", {
			title,
			workspace,
			filename,
			bundleId: snapshot.app.bundleId,
		});

		if (!workspace && !filename) {
			logger.debug("No workspace or filename extracted, skipping");
			return null;
		}

		const content: ContentDescriptor = {
			kind: "ide_workspace",
			id: workspace ?? "unknown",
			title: workspace,
			urlCanonical: "",
			subtitle: filename,
			metadata: {
				filename,
				workspace,
				editor: snapshot.app.name,
			},
		};

		return {
			url: null,
			content,
			confidence: workspace ? 0.85 : 0.5,
		};
	},
};
