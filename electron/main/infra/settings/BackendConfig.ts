import { DEFAULT_BACKEND_URL, getSettings } from "./SettingsStore";

export function getBackendUrl(): string {
	const settings = getSettings();
	if (settings.customBackendEnabled && settings.customBackendUrl.trim()) {
		return settings.customBackendUrl.trim().replace(/\/+$/, "");
	}
	return DEFAULT_BACKEND_URL;
}

export async function testBackendConnection(): Promise<{
	success: boolean;
	error?: string;
	version?: string;
}> {
	const url = getBackendUrl();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10_000);

		const response = await fetch(`${url}/api/init`, {
			method: "POST",
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!response.ok) {
			return {
				success: false,
				error: `Server returned ${response.status}: ${response.statusText}`,
			};
		}

		const data = (await response.json()) as {
			success?: boolean;
			message?: string;
		};
		if (data.success) {
			return { success: true, version: data.message };
		}

		return { success: false, error: "Unexpected response from server" };
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				return { success: false, error: "Connection timed out" };
			}
			return { success: false, error: error.message };
		}
		return { success: false, error: "Unknown error" };
	}
}
