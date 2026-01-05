import {
	listRoomMembershipsByRole,
	upsertRoomMembership,
} from "../../infra/db/repositories/RoomMembershipsRepository";
import { createLogger } from "../../infra/log";
import {
	createOwnedRoom,
	fetchAndSyncRoomMembers,
	getInviteStatusForFriend,
	getRoomKey,
	inviteFriendToRoom,
	listRooms,
} from "../rooms/RoomsService";
import { listFriends } from "../social/FriendsService";
import { getIdentity } from "../social/IdentityService";
import { FRIENDS_FEED_ROOM_NAME, isFriendsFeedRoomName } from "./constants";

const logger = createLogger({ scope: "FriendsFeedRoom" });

let ensurePromise: Promise<string> | null = null;

async function resolveOwnedFriendsFeedRoomId(): Promise<string | null> {
	const identity = getIdentity();
	if (!identity) return null;

	const localOwned = listRoomMembershipsByRole("owner").find(
		(m) =>
			m.ownerUserId === identity.userId && isFriendsFeedRoomName(m.roomName),
	);
	if (localOwned) return localOwned.roomId;

	const rooms = await listRooms();
	const owned = rooms
		.filter(
			(r) =>
				r.role === "owner" &&
				r.createdBy === identity.userId &&
				isFriendsFeedRoomName(r.name),
		)
		.sort((a, b) => b.createdAt - a.createdAt);

	const found = owned[0] ?? null;
	if (!found) return null;

	upsertRoomMembership({
		roomId: found.id,
		roomName: found.name,
		role: "owner",
		ownerUserId: identity.userId,
		ownerUsername: identity.username,
		joinedAt: found.createdAt,
		lastSyncedAt: null,
	});

	return found.id;
}

async function reconcileAllFriendsInvites(roomId: string): Promise<void> {
	await fetchAndSyncRoomMembers(roomId);
	const friends = await listFriends();

	for (const f of friends) {
		const status = getInviteStatusForFriend(roomId, f.userId);
		if (status !== "none") continue;

		try {
			await inviteFriendToRoom({
				roomId,
				friendUserId: f.userId,
				friendUsername: f.username,
			});
		} catch (error) {
			logger.warn("Invite friend to feed room failed", {
				roomId,
				friendUserId: f.userId,
				error: String(error),
			});
		}
	}
}

export async function ensureFriendsFeedRoom(params?: {
	reconcileInvites?: boolean;
}): Promise<string> {
	if (ensurePromise) return ensurePromise;

	ensurePromise = (async () => {
		const identity = getIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		let roomId = await resolveOwnedFriendsFeedRoomId();
		if (!roomId) {
			roomId = await createOwnedRoom({
				name: FRIENDS_FEED_ROOM_NAME,
				visibility: "private",
			});
		}

		await getRoomKey(roomId);

		if (params?.reconcileInvites !== false) {
			await reconcileAllFriendsInvites(roomId);
		}

		return roomId;
	})().finally(() => {
		ensurePromise = null;
	});

	return await ensurePromise;
}
