import { describe, expect, it } from "vitest";
import {
	netflixResolver,
	resolveContent,
	twitchResolver,
	youtubeResolver,
} from "../resolvers";

describe("youtubeResolver", () => {
	it("resolves standard watch URL", () => {
		const result = youtubeResolver.resolve(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"Rick Astley",
		);
		expect(result).not.toBeNull();
		expect(result?.content.kind).toBe("youtube_video");
		expect(result?.content.id).toBe("dQw4w9WgXcQ");
		expect(result?.content.title).toBe("Rick Astley");
	});

	it("resolves youtu.be short URL", () => {
		const result = youtubeResolver.resolve(
			"https://youtu.be/dQw4w9WgXcQ",
			null,
		);
		expect(result?.content.id).toBe("dQw4w9WgXcQ");
	});

	it("resolves shorts URL", () => {
		const result = youtubeResolver.resolve(
			"https://www.youtube.com/shorts/abc12345678",
			"Short Video",
		);
		expect(result?.content.kind).toBe("youtube_short");
		expect(result?.content.id).toBe("abc12345678");
	});

	it("resolves embed URL", () => {
		const result = youtubeResolver.resolve(
			"https://www.youtube.com/embed/dQw4w9WgXcQ",
			null,
		);
		expect(result?.content.id).toBe("dQw4w9WgXcQ");
	});

	it("returns null for non-YouTube URLs", () => {
		const result = youtubeResolver.resolve(
			"https://netflix.com/watch/123",
			null,
		);
		expect(result).toBeNull();
	});

	it("returns null for YouTube homepage", () => {
		const result = youtubeResolver.resolve("https://www.youtube.com/", null);
		expect(result).toBeNull();
	});

	it("handles URL with tracking params", () => {
		const result = youtubeResolver.resolve(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc123",
			null,
		);
		expect(result?.content.id).toBe("dQw4w9WgXcQ");
		expect(result?.content.urlCanonical).toBe(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
	});
});

describe("netflixResolver", () => {
	it("resolves watch URL", () => {
		const result = netflixResolver.resolve(
			"https://www.netflix.com/watch/81234567",
			"Stranger Things",
		);
		expect(result?.content.kind).toBe("netflix_title");
		expect(result?.content.id).toBe("81234567");
	});

	it("returns null for non-watch pages", () => {
		const result = netflixResolver.resolve(
			"https://www.netflix.com/browse",
			null,
		);
		expect(result).toBeNull();
	});

	it("returns null for non-Netflix URLs", () => {
		const result = netflixResolver.resolve(
			"https://youtube.com/watch?v=abc",
			null,
		);
		expect(result).toBeNull();
	});
});

describe("twitchResolver", () => {
	it("resolves channel stream URL", () => {
		const result = twitchResolver.resolve(
			"https://www.twitch.tv/shroud",
			"shroud - Twitch",
		);
		expect(result?.content.kind).toBe("twitch_stream");
		expect(result?.content.id).toBe("shroud");
	});

	it("resolves VOD URL", () => {
		const result = twitchResolver.resolve(
			"https://www.twitch.tv/videos/123456789",
			"Past Broadcast",
		);
		expect(result?.content.kind).toBe("twitch_vod");
		expect(result?.content.id).toBe("123456789");
	});

	it("ignores reserved paths like directory", () => {
		const result = twitchResolver.resolve(
			"https://www.twitch.tv/directory",
			null,
		);
		expect(result).toBeNull();
	});

	it("returns null for non-Twitch URLs", () => {
		const result = twitchResolver.resolve("https://youtube.com/shroud", null);
		expect(result).toBeNull();
	});
});

describe("resolveContent", () => {
	it("returns YouTube before web_page", () => {
		const result = resolveContent(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			null,
		);
		expect(result?.content.kind).toBe("youtube_video");
	});

	it("falls back to web_page for unknown domains", () => {
		const result = resolveContent(
			"https://example.com/some/page",
			"Example Page",
		);
		expect(result?.content.kind).toBe("web_page");
		expect(result?.content.id).toBe("example.com/some/page");
	});

	it("returns null for invalid URLs", () => {
		const result = resolveContent("not-a-url", null);
		expect(result).toBeNull();
	});
});
