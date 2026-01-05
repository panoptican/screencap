import type { DayWrappedSnapshot, SharedEvent } from "../../../shared/types";
import { getLatestCachedDayWrappedForAuthor } from "../../infra/db/repositories/RoomDayWrappedCacheRepository";
import type { CachedRoomEvent } from "../../infra/db/repositories/RoomEventsCacheRepository";
import { listLatestCachedRoomEvents } from "../../infra/db/repositories/RoomEventsCacheRepository";
import { listRoomMemberships } from "../../infra/db/repositories/RoomMembershipsRepository";
import { getIdentity } from "../social/IdentityService";
import { isFriendsFeedRoomName } from "./constants";

function cachedEventToSharedEvent(event: CachedRoomEvent): SharedEvent {
	return {
		id: event.id,
		roomId: event.roomId,
		authorUserId: event.authorUserId,
		authorUsername: event.authorUsername,
		timestampMs: event.timestampMs,
		endTimestampMs: event.endTimestampMs,
		project: event.project,
		category: event.category,
		caption: event.caption,
		projectProgress: event.projectProgress,
		appBundleId: event.appBundleId,
		appName: event.appName,
		windowTitle: event.windowTitle,
		contentKind: event.contentKind,
		contentTitle: event.contentTitle,
		thumbnailPath: event.thumbnailPath,
		originalPath: event.originalPath,
	};
}

export function getSocialFeedEvents(params?: {
	startDate?: number;
	endDate?: number;
	limit?: number;
}): SharedEvent[] {
	const identity = getIdentity();
	if (!identity) return [];

	const events = listLatestCachedRoomEvents({
		excludeAuthorId: identity.userId,
		startDate: params?.startDate,
		endDate: params?.endDate,
		limit: params?.limit,
	});

	return events.map(cachedEventToSharedEvent);
}

function findFriendsFeedRoomIdForOwner(ownerUserId: string): string | null {
	const memberships = listRoomMemberships();
	const match = memberships.find(
		(m) => m.ownerUserId === ownerUserId && isFriendsFeedRoomName(m.roomName),
	);
	return match?.roomId ?? null;
}

export function getLatestFriendDayWrappedSnapshot(
	friendUserId: string,
): DayWrappedSnapshot | null {
	const roomId = findFriendsFeedRoomIdForOwner(friendUserId);
	if (!roomId) return null;

	const cached = getLatestCachedDayWrappedForAuthor({
		roomId,
		authorUserId: friendUserId,
	});
	if (!cached) return null;

	return {
		roomId,
		authorUserId: cached.authorUserId,
		authorUsername: cached.authorUsername,
		publishedAtMs: cached.timestampMs,
		dayStartMs: cached.dayStartMs,
		slots: cached.slots,
	};
}
