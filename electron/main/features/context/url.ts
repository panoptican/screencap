const TRACKING_PARAMS = new Set([
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"fbclid",
	"gclid",
	"gclsrc",
	"dclid",
	"msclkid",
	"zanpid",
	"ref",
	"ref_",
	"feature",
	"si",
	"pp",
	"igshid",
]);

export function canonicalizeUrl(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		const params = new URLSearchParams();

		for (const [key, value] of url.searchParams.entries()) {
			if (!TRACKING_PARAMS.has(key.toLowerCase())) {
				params.set(key, value);
			}
		}

		url.search = params.toString();
		url.hash = "";

		return url.toString();
	} catch {
		return null;
	}
}

export function extractHost(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		return url.hostname;
	} catch {
		return null;
	}
}

export function extractPath(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		return url.pathname;
	} catch {
		return null;
	}
}
