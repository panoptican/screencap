import { describe, expect, it } from "vitest";
import type { BackgroundContext } from "../types";

interface SpotifyParsedUri {
	type: "track" | "episode" | "unknown";
	id: string;
}

function parseSpotifyUri(uri: string): SpotifyParsedUri | null {
	const trackMatch = uri.match(/^spotify:track:([a-zA-Z0-9]+)$/);
	if (trackMatch) {
		return { type: "track", id: trackMatch[1] };
	}

	const episodeMatch = uri.match(/^spotify:episode:([a-zA-Z0-9]+)$/);
	if (episodeMatch) {
		return { type: "episode", id: episodeMatch[1] };
	}

	const urlMatch = uri.match(
		/open\.spotify\.com\/(track|episode)\/([a-zA-Z0-9]+)/,
	);
	if (urlMatch) {
		return { type: urlMatch[1] as "track" | "episode", id: urlMatch[2] };
	}

	return null;
}

function buildSpotifyCanonicalUrl(
	type: "track" | "episode" | "unknown",
	id: string,
): string {
	const pathType = type === "episode" ? "episode" : "track";
	return `https://open.spotify.com/${pathType}/${id}`;
}

function parseBackgroundFromContextJson(
	contextJson: string | null,
): BackgroundContext[] {
	if (!contextJson) return [];
	try {
		const parsed = JSON.parse(contextJson);
		if (Array.isArray(parsed?.background)) {
			return parsed.background;
		}
		return [];
	} catch {
		return [];
	}
}

describe("parseSpotifyUri", () => {
	it("parses spotify:track URI", () => {
		const result = parseSpotifyUri("spotify:track:4uLU6hMCjMI75M1A2tKUQC");
		expect(result).toEqual({ type: "track", id: "4uLU6hMCjMI75M1A2tKUQC" });
	});

	it("parses spotify:episode URI", () => {
		const result = parseSpotifyUri("spotify:episode:5Xt5DXGzch68nYYamXrNxZ");
		expect(result).toEqual({ type: "episode", id: "5Xt5DXGzch68nYYamXrNxZ" });
	});

	it("parses open.spotify.com track URL", () => {
		const result = parseSpotifyUri(
			"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
		);
		expect(result).toEqual({ type: "track", id: "4uLU6hMCjMI75M1A2tKUQC" });
	});

	it("parses open.spotify.com episode URL", () => {
		const result = parseSpotifyUri(
			"https://open.spotify.com/episode/5Xt5DXGzch68nYYamXrNxZ",
		);
		expect(result).toEqual({ type: "episode", id: "5Xt5DXGzch68nYYamXrNxZ" });
	});

	it("returns null for invalid URI", () => {
		expect(parseSpotifyUri("spotify:album:123")).toBeNull();
		expect(parseSpotifyUri("random-string")).toBeNull();
		expect(parseSpotifyUri("")).toBeNull();
	});

	it("returns null for playlist URI", () => {
		const result = parseSpotifyUri("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M");
		expect(result).toBeNull();
	});
});

describe("buildSpotifyCanonicalUrl", () => {
	it("builds track URL", () => {
		const url = buildSpotifyCanonicalUrl("track", "4uLU6hMCjMI75M1A2tKUQC");
		expect(url).toBe("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
	});

	it("builds episode URL", () => {
		const url = buildSpotifyCanonicalUrl("episode", "5Xt5DXGzch68nYYamXrNxZ");
		expect(url).toBe("https://open.spotify.com/episode/5Xt5DXGzch68nYYamXrNxZ");
	});

	it("defaults to track for unknown type", () => {
		const url = buildSpotifyCanonicalUrl("unknown", "abc123");
		expect(url).toBe("https://open.spotify.com/track/abc123");
	});
});

describe("parseBackgroundFromContextJson", () => {
	it("returns empty array for null contextJson", () => {
		expect(parseBackgroundFromContextJson(null)).toEqual([]);
	});

	it("returns empty array for invalid JSON", () => {
		expect(parseBackgroundFromContextJson("not json")).toEqual([]);
	});

	it("returns empty array when background field is missing", () => {
		const json = JSON.stringify({ app: "test", content: null });
		expect(parseBackgroundFromContextJson(json)).toEqual([]);
	});

	it("returns empty array when background is not an array", () => {
		const json = JSON.stringify({ background: "not an array" });
		expect(parseBackgroundFromContextJson(json)).toEqual([]);
	});

	it("extracts background array from contextJson", () => {
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
		const json = JSON.stringify({
			app: { bundleId: "com.google.Chrome" },
			background,
		});

		const result = parseBackgroundFromContextJson(json);
		expect(result).toHaveLength(1);
		expect(result[0].provider).toBe("spotify");
		expect(result[0].kind).toBe("spotify_track");
		expect(result[0].title).toBe("Bohemian Rhapsody");
		expect(result[0].subtitle).toBe("Queen");
		expect(result[0].actionUrl).toBe("spotify:track:4uLU6hMCjMI75M1A2tKUQC");
	});

	it("handles multiple background items", () => {
		const background: BackgroundContext[] = [
			{
				provider: "spotify",
				kind: "spotify_track",
				id: "track1",
				title: "Track 1",
				subtitle: "Artist 1",
				imageUrl: null,
				actionUrl: "spotify:track:track1",
			},
			{
				provider: "discord",
				kind: "voice_chat",
				id: "channel1",
				title: "Voice Channel",
				subtitle: "3 members",
				imageUrl: null,
				actionUrl: null,
			},
		];
		const json = JSON.stringify({ background });

		const result = parseBackgroundFromContextJson(json);
		expect(result).toHaveLength(2);
		expect(result[0].provider).toBe("spotify");
		expect(result[1].provider).toBe("discord");
	});
});
