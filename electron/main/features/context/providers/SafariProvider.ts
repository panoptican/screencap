import { createLogger } from "../../../infra/log";
import { isAutomationDenied, runAppleScript } from "../applescript";
import { resolveContent } from "../resolvers";
import type {
	ContextEnrichment,
	ForegroundSnapshot,
	UrlMetadata,
} from "../types";
import { canonicalizeUrl, extractHost } from "../url";
import type { ContextProvider } from "./types";

const logger = createLogger({ scope: "SafariProvider" });

const SAFARI_BUNDLE_IDS = new Set([
	"com.apple.Safari",
	"com.apple.SafariTechnologyPreview",
]);

const SAFARI_TAB_SCRIPT = `
tell application "Safari"
  set frontDoc to front document
  set tabUrl to URL of frontDoc
  set tabTitle to name of frontDoc
  return tabUrl & "|||" & tabTitle
end tell
`;

type AutomationState = "not-attempted" | "granted" | "denied";

let automationState: AutomationState = "not-attempted";
let lastAutomationError: string | null = null;

export const safariProvider: ContextProvider = {
	id: "safari",

	supports(snapshot: ForegroundSnapshot): boolean {
		return SAFARI_BUNDLE_IDS.has(snapshot.app.bundleId);
	},

	async collect(
		snapshot: ForegroundSnapshot,
	): Promise<ContextEnrichment | null> {
		if (!this.supports(snapshot)) return null;

		const result = await runAppleScript(SAFARI_TAB_SCRIPT);

		if (!result.success) {
			if (isAutomationDenied(result.error)) {
				automationState = "denied";
				lastAutomationError = result.error;
				logger.warn("Automation permission denied for Safari");
			}
			return null;
		}

		const parts = result.output.split("|||");
		if (parts.length < 2) return null;

		const rawUrl = parts[0];
		const title = parts[1] || null;

		const canonical = canonicalizeUrl(rawUrl);
		if (!canonical) return null;

		const host = extractHost(rawUrl);
		if (!host) return null;

		const url: UrlMetadata = {
			urlCanonical: canonical,
			host,
			title,
		};

		const resolved = resolveContent(canonical, title);

		automationState = "granted";
		lastAutomationError = null;

		return {
			url,
			content: resolved?.content ?? null,
			confidence: resolved?.confidence ?? 0.6,
		};
	},
};

export function getSafariAutomationError(): string | null {
	return lastAutomationError;
}

export function getSafariAutomationState(): AutomationState {
	return automationState;
}
