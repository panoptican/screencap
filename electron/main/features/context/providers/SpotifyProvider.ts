import { createLogger } from "../../../infra/log";
import { isAutomationDenied, runAppleScript } from "../applescript";
import type {
	BackgroundContext,
	ContentDescriptor,
	ContentKind,
	ContextEnrichment,
	ForegroundSnapshot,
	UrlMetadata,
} from "../types";
import type { BackgroundCapableProvider } from "./types";

const logger = createLogger({ scope: "SpotifyProvider" });

const SPOTIFY_BUNDLE_IDS = new Set(["com.spotify.client"]);

const SPOTIFY_STATE_SCRIPT = `
if application "Spotify" is running then
  tell application "Spotify"
    if player state is stopped then
      return "stopped"
    end if
    set trackName to name of current track
    set artistName to artist of current track
    set albumName to album of current track
    set spotifyUrl to spotify url of current track
    set playerState to player state as string
    try
      set artUrl to artwork url of current track
    on error
      set artUrl to ""
    end try
    return playerState & "|||" & spotifyUrl & "|||" & trackName & "|||" & artistName & "|||" & albumName & "|||" & artUrl
  end tell
else
  return "not_running"
end if
`;

interface SpotifyParsedUri {
	type: "track" | "episode" | "unknown";
	id: string;
}

interface SpotifyTrackData {
	playerState: string;
	spotifyUri: string;
	trackName: string;
	artistName: string;
	albumName: string;
	artworkUrl: string;
	parsed: SpotifyParsedUri;
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

function spotifyTypeToContentKind(
	type: "track" | "episode" | "unknown",
): ContentKind {
	switch (type) {
		case "track":
			return "spotify_track";
		case "episode":
			return "spotify_episode";
		default:
			return "spotify_track";
	}
}

function buildSpotifyCanonicalUrl(
	type: "track" | "episode" | "unknown",
	id: string,
): string {
	const pathType = type === "episode" ? "episode" : "track";
	return `https://open.spotify.com/${pathType}/${id}`;
}

type AutomationState = "not-attempted" | "granted" | "denied";

let automationState: AutomationState = "not-attempted";
let lastAutomationError: string | null = null;

async function fetchSpotifyState(): Promise<
	SpotifyTrackData | "stopped" | "not_running" | null
> {
	const result = await runAppleScript(SPOTIFY_STATE_SCRIPT);

	if (!result.success) {
		if (isAutomationDenied(result.error)) {
			automationState = "denied";
			lastAutomationError = result.error;
			logger.warn("Automation permission denied for Spotify");
		}
		return null;
	}

	const output = result.output.trim();

	if (output === "stopped") return "stopped";
	if (output === "not_running") return "not_running";

	const parts = output.split("|||");
	if (parts.length < 5) {
		logger.debug("Unexpected Spotify output format", { output });
		return null;
	}

	const [
		playerState,
		spotifyUri,
		trackName,
		artistName,
		albumName,
		artworkUrl,
	] = parts;

	const parsed = parseSpotifyUri(spotifyUri);
	if (!parsed) {
		logger.debug("Failed to parse Spotify URI", { spotifyUri });
		return null;
	}

	automationState = "granted";
	lastAutomationError = null;

	return {
		playerState,
		spotifyUri,
		trackName,
		artistName,
		albumName,
		artworkUrl: artworkUrl || "",
		parsed,
	};
}

export const spotifyProvider: BackgroundCapableProvider = {
	id: "spotify",
	priority: 10,

	supports(snapshot: ForegroundSnapshot): boolean {
		return SPOTIFY_BUNDLE_IDS.has(snapshot.app.bundleId);
	},

	async collect(
		snapshot: ForegroundSnapshot,
	): Promise<ContextEnrichment | null> {
		if (!this.supports(snapshot)) return null;

		const state = await fetchSpotifyState();

		if (!state || state === "stopped" || state === "not_running") {
			logger.debug("Spotify not playing", { state });
			return null;
		}

		const contentKind = spotifyTypeToContentKind(state.parsed.type);
		const canonicalUrl = buildSpotifyCanonicalUrl(
			state.parsed.type,
			state.parsed.id,
		);

		const content: ContentDescriptor = {
			kind: contentKind,
			id: state.parsed.id,
			title: state.trackName || null,
			urlCanonical: canonicalUrl,
			subtitle: state.artistName || null,
			imageUrl: state.artworkUrl || null,
			metadata: {
				album: state.albumName || null,
				playerState: state.playerState,
				spotifyUri: state.spotifyUri,
			},
		};

		const url: UrlMetadata = {
			urlCanonical: canonicalUrl,
			host: "open.spotify.com",
			title: state.trackName || null,
		};

		return {
			url,
			content,
			confidence: 0.95,
		};
	},

	async collectBackground(): Promise<BackgroundContext | null> {
		const state = await fetchSpotifyState();

		if (!state || state === "stopped" || state === "not_running") {
			return null;
		}

		if (state.playerState !== "playing") {
			return null;
		}

		const contentKind = spotifyTypeToContentKind(state.parsed.type);

		return {
			provider: "spotify",
			kind: contentKind,
			id: state.parsed.id,
			title: state.trackName || null,
			subtitle: state.artistName || null,
			imageUrl: state.artworkUrl || null,
			actionUrl: state.spotifyUri,
		};
	},
};

export function getSpotifyAutomationError(): string | null {
	return lastAutomationError;
}

export function getSpotifyAutomationState(): AutomationState {
	return automationState;
}

export { SPOTIFY_BUNDLE_IDS };
