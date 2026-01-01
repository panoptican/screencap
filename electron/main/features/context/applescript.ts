import { exec } from "node:child_process";
import { createLogger } from "../../infra/log";

const logger = createLogger({ scope: "AppleScript" });

const DEFAULT_TIMEOUT_MS = 2000;

export interface AppleScriptResult {
	success: boolean;
	output: string;
	error: string | null;
	timedOut: boolean;
}

export async function runAppleScript(
	script: string,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AppleScriptResult> {
	return new Promise((resolve) => {
		const child = exec(
			`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
			{ timeout: timeoutMs },
			(error, stdout, stderr) => {
				if (error) {
					const timedOut = error.killed || error.message.includes("ETIMEDOUT");
					logger.debug("AppleScript failed", {
						error: error.message,
						timedOut,
					});
					resolve({
						success: false,
						output: stdout.trim(),
						error: timedOut ? "timeout" : stderr.trim() || error.message,
						timedOut,
					});
					return;
				}

				resolve({
					success: true,
					output: stdout.trim(),
					error: null,
					timedOut: false,
				});
			},
		);

		setTimeout(() => {
			if (!child.killed) {
				child.kill("SIGTERM");
			}
		}, timeoutMs + 100);
	});
}

export function isAutomationDenied(error: string | null): boolean {
	if (!error) return false;
	const denialPatterns = [
		"not authorized",
		"not allowed to send",
		"access not allowed",
		"assistive access",
		"System Events got an error",
	];
	const lower = error.toLowerCase();
	return denialPatterns.some((p) => lower.includes(p.toLowerCase()));
}
