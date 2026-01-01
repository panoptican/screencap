export const SELF_APP_BUNDLE_ID = "com.screencap.app";
export const SELF_APP_NAME = "Screencap";

function normalize(value: string | null | undefined): string {
	return (value ?? "").trim().toLowerCase();
}

export function isSelfApp(input: {
	bundleId: string | null | undefined;
	name: string | null | undefined;
	windowTitle: string | null | undefined;
}): boolean {
	const bundleId = normalize(input.bundleId);
	if (bundleId === SELF_APP_BUNDLE_ID) return true;

	const needle = SELF_APP_NAME.toLowerCase();
	const name = normalize(input.name);
	if (name.includes(needle)) return true;

	const windowTitle = normalize(input.windowTitle);
	if (windowTitle.includes(needle)) return true;

	return false;
}
