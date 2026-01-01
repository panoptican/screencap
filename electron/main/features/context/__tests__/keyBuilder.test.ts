import { describe, expect, it } from "vitest";
import { buildActivityContext, buildContextKey } from "../keyBuilder";
import type {
	BackgroundContext,
	ContentDescriptor,
	ForegroundApp,
	ForegroundWindow,
	UrlMetadata,
} from "../types";

const mockApp: ForegroundApp = {
	name: "Google Chrome",
	bundleId: "com.google.Chrome",
	pid: 1234,
};

const mockWindow: ForegroundWindow = {
	title: "YouTube - Google Chrome",
	bounds: { x: 0, y: 0, width: 1920, height: 1080 },
	displayId: "1",
	isFullscreen: true,
};

describe("buildContextKey", () => {
	it("returns youtube key for youtube_video content", () => {
		const content: ContentDescriptor = {
			kind: "youtube_video",
			id: "dQw4w9WgXcQ",
			title: "Rick Astley",
			urlCanonical: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("youtube:dQw4w9WgXcQ");
	});

	it("returns netflix key for netflix_title content", () => {
		const content: ContentDescriptor = {
			kind: "netflix_title",
			id: "81234567",
			title: "Stranger Things",
			urlCanonical: "https://www.netflix.com/watch/81234567",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("netflix:81234567");
	});

	it("returns twitch live key for twitch_stream", () => {
		const content: ContentDescriptor = {
			kind: "twitch_stream",
			id: "shroud",
			title: null,
			urlCanonical: "https://www.twitch.tv/shroud",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("twitch:live:shroud");
	});

	it("returns twitch vod key for twitch_vod", () => {
		const content: ContentDescriptor = {
			kind: "twitch_vod",
			id: "123456789",
			title: null,
			urlCanonical: "https://www.twitch.tv/videos/123456789",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("twitch:vod:123456789");
	});

	it("returns web key for web_page content", () => {
		const content: ContentDescriptor = {
			kind: "web_page",
			id: "example.com/page",
			title: null,
			urlCanonical: "https://example.com/page",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("web:example.com/page");
	});

	it("returns spotify:track key for spotify_track content", () => {
		const content: ContentDescriptor = {
			kind: "spotify_track",
			id: "4uLU6hMCjMI75M1A2tKUQC",
			title: "Never Gonna Give You Up",
			urlCanonical: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("spotify:track:4uLU6hMCjMI75M1A2tKUQC");
	});

	it("returns spotify:episode key for spotify_episode content", () => {
		const content: ContentDescriptor = {
			kind: "spotify_episode",
			id: "5Xt5DXGzch68nYYamXrNxZ",
			title: "Podcast Episode",
			urlCanonical: "https://open.spotify.com/episode/5Xt5DXGzch68nYYamXrNxZ",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("spotify:episode:5Xt5DXGzch68nYYamXrNxZ");
	});

	it("returns generic content key for unknown content kinds", () => {
		const content: ContentDescriptor = {
			kind: "custom_app_state",
			id: "some-id-123",
			title: "Custom State",
			urlCanonical: "https://example.com/custom",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("content:custom_app_state:some-id-123");
	});

	it("sanitizes unknown content kind and id in fallback key", () => {
		const content: ContentDescriptor = {
			kind: "My Custom Kind!",
			id: "id with spaces & symbols!",
			title: "Test",
			urlCanonical: "https://example.com",
		};
		const key = buildContextKey(mockApp, mockWindow, null, content);
		expect(key).toBe("content:my_custom_kind_:id_with_spaces_symbols_");
	});

	it("falls back to url host:path when no content", () => {
		const url: UrlMetadata = {
			urlCanonical: "https://example.com/some/path",
			host: "example.com",
			title: "Example",
		};
		const key = buildContextKey(mockApp, mockWindow, url, null);
		expect(key).toBe("web:example.com:/some/path");
	});

	it("falls back to app:bundleId:windowTitle when no url", () => {
		const key = buildContextKey(mockApp, mockWindow, null, null);
		expect(key).toBe("app:com.google.Chrome:youtube_google_chrome");
	});

	it("falls back to app:bundleId when no window title", () => {
		const windowNoTitle: ForegroundWindow = { ...mockWindow, title: "" };
		const key = buildContextKey(mockApp, windowNoTitle, null, null);
		expect(key).toBe("app:com.google.Chrome");
	});
});

describe("buildActivityContext", () => {
	it("builds complete ActivityContext with key", () => {
		const content: ContentDescriptor = {
			kind: "youtube_video",
			id: "dQw4w9WgXcQ",
			title: "Never Gonna Give You Up",
			urlCanonical: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		};

		const context = buildActivityContext(
			Date.now(),
			mockApp,
			mockWindow,
			null,
			content,
			"chromium",
			0.95,
		);

		expect(context.key).toBe("youtube:dQw4w9WgXcQ");
		expect(context.app.bundleId).toBe("com.google.Chrome");
		expect(context.provider).toBe("chromium");
		expect(context.confidence).toBe(0.95);
		expect(context.background).toEqual([]);
	});

	it("includes background context when provided", () => {
		const content: ContentDescriptor = {
			kind: "youtube_video",
			id: "dQw4w9WgXcQ",
			title: "Never Gonna Give You Up",
			urlCanonical: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		};

		const background: BackgroundContext[] = [
			{
				provider: "spotify",
				kind: "spotify_track",
				id: "4uLU6hMCjMI75M1A2tKUQC",
				title: "Bohemian Rhapsody",
				subtitle: "Queen",
				imageUrl: "https://i.scdn.co/image/abc123",
				actionUrl: "spotify:track:4uLU6hMCjMI75M1A2tKUQC",
			},
		];

		const context = buildActivityContext(
			Date.now(),
			mockApp,
			mockWindow,
			null,
			content,
			"chromium",
			0.95,
			background,
		);

		expect(context.background).toHaveLength(1);
		expect(context.background[0].provider).toBe("spotify");
		expect(context.background[0].kind).toBe("spotify_track");
		expect(context.background[0].title).toBe("Bohemian Rhapsody");
		expect(context.background[0].subtitle).toBe("Queen");
	});

	it("defaults to empty background array when not provided", () => {
		const context = buildActivityContext(
			Date.now(),
			mockApp,
			mockWindow,
			null,
			null,
			"none",
			0.3,
		);

		expect(context.background).toEqual([]);
	});
});
