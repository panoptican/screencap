import { create } from "zustand";
import type { Friend, SocialIdentity } from "@/types";

type SocialDirectoryStatus = "idle" | "loading" | "error";

export interface SocialDirectoryState {
	identity: SocialIdentity | null;
	friends: Friend[];
	friendsByUserId: Record<string, Friend>;
	status: SocialDirectoryStatus;
	error: string | null;
	lastUpdatedAt: number | null;
	refresh: (options?: { force?: boolean }) => Promise<void>;
	setIdentity: (identity: SocialIdentity | null) => void;
	setFriends: (friends: Friend[]) => void;
	clear: () => void;
}

const REFRESH_TTL_MS = 10_000;

let inFlightRefresh: Promise<void> | null = null;

function toFriendsByUserId(friends: Friend[]): Record<string, Friend> {
	const map: Record<string, Friend> = {};
	for (const f of friends) map[f.userId] = f;
	return map;
}

export const useSocialDirectoryStore = create<SocialDirectoryState>(
	(set, get) => ({
		identity: null,
		friends: [],
		friendsByUserId: {},
		status: "idle",
		error: null,
		lastUpdatedAt: null,

		setIdentity: (identity) => set({ identity }),
		setFriends: (friends) =>
			set({ friends, friendsByUserId: toFriendsByUserId(friends) }),
		clear: () =>
			set({
				identity: null,
				friends: [],
				friendsByUserId: {},
				status: "idle",
				error: null,
				lastUpdatedAt: Date.now(),
			}),

		refresh: async (options) => {
			const force = options?.force ?? false;

			if (!window.api?.social) {
				// In non-electron contexts we keep the store empty.
				get().clear();
				return;
			}

			const now = Date.now();
			const last = get().lastUpdatedAt;
			if (!force && last != null && now - last < REFRESH_TTL_MS) return;

			if (inFlightRefresh) return inFlightRefresh;

			inFlightRefresh = (async () => {
				set({ status: "loading", error: null });
				try {
					const identity = await window.api.social.getIdentity();
					set({ identity });

					if (!identity) {
						set({
							friends: [],
							friendsByUserId: {},
							status: "idle",
							error: null,
							lastUpdatedAt: Date.now(),
						});
						return;
					}

					const friends = await window.api.social.listFriends();
					set({
						friends,
						friendsByUserId: toFriendsByUserId(friends),
						status: "idle",
						error: null,
						lastUpdatedAt: Date.now(),
					});
				} catch (e) {
					set({
						status: "error",
						error: String(e),
						lastUpdatedAt: Date.now(),
					});
				} finally {
					inFlightRefresh = null;
				}
			})();

			return inFlightRefresh;
		},
	}),
);
