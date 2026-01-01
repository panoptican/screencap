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

const logger = createLogger({ scope: "ChromiumProvider" });

interface ChromiumBrowserConfig {
	bundleId: string;
	appName: string;
}

const CHROMIUM_BROWSERS: ChromiumBrowserConfig[] = [
	{ bundleId: "com.google.Chrome", appName: "Google Chrome" },
	{ bundleId: "com.google.Chrome.canary", appName: "Google Chrome Canary" },
	{ bundleId: "com.brave.Browser", appName: "Brave Browser" },
	{ bundleId: "com.microsoft.edgemac", appName: "Microsoft Edge" },
	{ bundleId: "company.thebrowser.dia", appName: "Dia" },
	{ bundleId: "com.operasoftware.Opera", appName: "Opera" },
	{ bundleId: "com.vivaldi.Vivaldi", appName: "Vivaldi" },
];

const CHROMIUM_BUNDLE_IDS = new Set(CHROMIUM_BROWSERS.map((b) => b.bundleId));

function buildChromiumTabScript(appName: string): string {
	return `
tell application "${appName}"
  set activeTab to active tab of front window
  set tabUrl to URL of activeTab
  set tabTitle to title of activeTab
  return tabUrl & "|||" & tabTitle
end tell
`;
}

function buildDiaTabScript(): string {
	return `
tell application "Dia"
  set tabCount to count of tabs of window 1
  repeat with i from 1 to tabCount
    if isFocused of tab i of window 1 then
      return (URL of tab i of window 1) & "|||" & (name of tab i of window 1)
    end if
  end repeat
  return (URL of tab 1 of window 1) & "|||" & (name of tab 1 of window 1)
end tell
`;
}

type AutomationState = "not-attempted" | "granted" | "denied";

let automationState: AutomationState = "not-attempted";
let lastAutomationError: string | null = null;

export const chromiumProvider: ContextProvider = {
	id: "chromium",

	supports(snapshot: ForegroundSnapshot): boolean {
		return CHROMIUM_BUNDLE_IDS.has(snapshot.app.bundleId);
	},

	async collect(
		snapshot: ForegroundSnapshot,
	): Promise<ContextEnrichment | null> {
		if (!this.supports(snapshot)) return null;

		const browserConfig = CHROMIUM_BROWSERS.find(
			(b) => b.bundleId === snapshot.app.bundleId,
		);
		if (!browserConfig) return null;

		const isDia = snapshot.app.bundleId === "company.thebrowser.dia";
		const script = isDia
			? buildDiaTabScript()
			: buildChromiumTabScript(browserConfig.appName);
		const result = await runAppleScript(script);

		if (!result.success) {
			if (isAutomationDenied(result.error)) {
				automationState = "denied";
				lastAutomationError = result.error;
				logger.warn("Automation permission denied for Chromium browser", {
					app: browserConfig.appName,
				});
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

export function getChromiumAutomationError(): string | null {
	return lastAutomationError;
}

export function getChromiumAutomationState(): AutomationState {
	return automationState;
}

export function getSupportedBrowserBundleIds(): string[] {
	return Array.from(CHROMIUM_BUNDLE_IDS).concat(
		"com.apple.Safari",
		"com.apple.SafariTechnologyPreview",
	);
}
