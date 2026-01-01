import type { ContentDescriptor, ContentKind } from "./types";
import { canonicalizeUrl, extractHost, extractPath } from "./url";

export interface ResolverResult {
	content: ContentDescriptor;
	confidence: number;
}

export interface UrlContentResolver {
	id: string;
	resolve(url: string, title: string | null): ResolverResult | null;
}

const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"youtu.be",
	"www.youtu.be",
]);

const youtubeResolver: UrlContentResolver = {
	id: "youtube",
	resolve(url: string, title: string | null): ResolverResult | null {
		const host = extractHost(url);
		if (!host || !YOUTUBE_HOSTS.has(host)) return null;

		const path = extractPath(url);
		if (!path) return null;

		let videoId: string | null = null;
		let kind: ContentKind = "youtube_video";

		if (host === "youtu.be" || host === "www.youtu.be") {
			const match = path.match(/^\/([a-zA-Z0-9_-]{11})/);
			if (match) videoId = match[1];
		} else {
			if (path.startsWith("/watch")) {
				try {
					const urlObj = new URL(url);
					videoId = urlObj.searchParams.get("v");
				} catch {
					return null;
				}
			} else if (path.startsWith("/shorts/")) {
				const match = path.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
				if (match) {
					videoId = match[1];
					kind = "youtube_short";
				}
			} else if (path.startsWith("/embed/")) {
				const match = path.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
				if (match) videoId = match[1];
			} else if (path.startsWith("/v/")) {
				const match = path.match(/^\/v\/([a-zA-Z0-9_-]{11})/);
				if (match) videoId = match[1];
			}
		}

		if (!videoId || videoId.length !== 11) return null;

		const canonical = canonicalizeUrl(
			`https://www.youtube.com/watch?v=${videoId}`,
		);

		return {
			content: {
				kind,
				id: videoId,
				title,
				urlCanonical: canonical ?? url,
			},
			confidence: 0.95,
		};
	},
};

const NETFLIX_HOSTS = new Set(["netflix.com", "www.netflix.com"]);

const netflixResolver: UrlContentResolver = {
	id: "netflix",
	resolve(url: string, title: string | null): ResolverResult | null {
		const host = extractHost(url);
		if (!host || !NETFLIX_HOSTS.has(host)) return null;

		const path = extractPath(url);
		if (!path) return null;

		const match = path.match(/^\/watch\/(\d+)/);
		if (!match) return null;

		const titleId = match[1];
		const canonical = canonicalizeUrl(
			`https://www.netflix.com/watch/${titleId}`,
		);

		return {
			content: {
				kind: "netflix_title",
				id: titleId,
				title,
				urlCanonical: canonical ?? url,
			},
			confidence: 0.9,
		};
	},
};

const TWITCH_HOSTS = new Set(["twitch.tv", "www.twitch.tv", "m.twitch.tv"]);

const twitchResolver: UrlContentResolver = {
	id: "twitch",
	resolve(url: string, title: string | null): ResolverResult | null {
		const host = extractHost(url);
		if (!host || !TWITCH_HOSTS.has(host)) return null;

		const path = extractPath(url);
		if (!path) return null;

		const vodMatch = path.match(/^\/videos\/(\d+)/);
		if (vodMatch) {
			const vodId = vodMatch[1];
			const canonical = canonicalizeUrl(
				`https://www.twitch.tv/videos/${vodId}`,
			);

			return {
				content: {
					kind: "twitch_vod",
					id: vodId,
					title,
					urlCanonical: canonical ?? url,
				},
				confidence: 0.9,
			};
		}

		const channelMatch = path.match(/^\/([a-zA-Z0-9_]{4,25})(?:\/|$)/);
		if (channelMatch) {
			const channel = channelMatch[1].toLowerCase();
			const excludedPaths = [
				"directory",
				"videos",
				"clips",
				"settings",
				"subscriptions",
				"inventory",
				"wallet",
				"drops",
			];
			if (excludedPaths.includes(channel)) return null;

			const canonical = canonicalizeUrl(`https://www.twitch.tv/${channel}`);

			return {
				content: {
					kind: "twitch_stream",
					id: channel,
					title,
					urlCanonical: canonical ?? url,
				},
				confidence: 0.85,
			};
		}

		return null;
	},
};

const webPageResolver: UrlContentResolver = {
	id: "web_page",
	resolve(url: string, title: string | null): ResolverResult | null {
		const host = extractHost(url);
		const path = extractPath(url);
		if (!host) return null;

		const canonical = canonicalizeUrl(url);
		const id = `${host}${path || "/"}`;

		return {
			content: {
				kind: "web_page",
				id,
				title,
				urlCanonical: canonical ?? url,
			},
			confidence: 0.5,
		};
	},
};

const resolvers: UrlContentResolver[] = [
	youtubeResolver,
	netflixResolver,
	twitchResolver,
	webPageResolver,
];

export function resolveContent(
	url: string,
	title: string | null,
): ResolverResult | null {
	for (const resolver of resolvers) {
		const result = resolver.resolve(url, title);
		if (result && result.content.kind !== "web_page") {
			return result;
		}
	}

	return webPageResolver.resolve(url, title);
}

export { youtubeResolver, netflixResolver, twitchResolver, webPageResolver };
