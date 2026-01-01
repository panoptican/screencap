import type {
	ActivityContext,
	BackgroundContext,
	ContentDescriptor,
	ForegroundApp,
	ForegroundWindow,
	UrlMetadata,
} from "./types";

function sanitizeContentId(id: string): string {
	return id.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 100);
}

function sanitizeContentKind(kind: string): string {
	return kind
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.slice(0, 50);
}

export function buildContextKey(
	app: ForegroundApp,
	window: ForegroundWindow,
	url: UrlMetadata | null,
	content: ContentDescriptor | null,
): string {
	if (content) {
		switch (content.kind) {
			case "youtube_video":
			case "youtube_short":
				return `youtube:${content.id}`;
			case "netflix_title":
				return `netflix:${content.id}`;
			case "twitch_stream":
				return `twitch:live:${content.id}`;
			case "twitch_vod":
				return `twitch:vod:${content.id}`;
			case "spotify_track":
				return `spotify:track:${content.id}`;
			case "spotify_episode":
				return `spotify:episode:${content.id}`;
			case "web_page":
				return `web:${content.id}`;
			default:
				return `content:${sanitizeContentKind(content.kind)}:${sanitizeContentId(content.id)}`;
		}
	}

	if (url) {
		return `web:${url.host}:${extractPathSegment(url.urlCanonical)}`;
	}

	if (window.title) {
		return `app:${app.bundleId}:${sanitizeWindowTitle(window.title)}`;
	}

	return `app:${app.bundleId}`;
}

function extractPathSegment(urlCanonical: string): string {
	try {
		const url = new URL(urlCanonical);
		return url.pathname.slice(0, 100);
	} catch {
		return "";
	}
}

function sanitizeWindowTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.slice(0, 50);
}

export function buildActivityContext(
	capturedAt: number,
	app: ForegroundApp,
	window: ForegroundWindow,
	url: UrlMetadata | null,
	content: ContentDescriptor | null,
	provider: string,
	confidence: number,
	background: BackgroundContext[] = [],
): ActivityContext {
	return {
		capturedAt,
		app,
		window,
		url,
		content,
		provider,
		confidence,
		key: buildContextKey(app, window, url, content),
		background,
	};
}
