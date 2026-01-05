export const FRIENDS_FEED_ROOM_NAME = "Friends Feed";

export function isFriendsFeedRoomName(name: string): boolean {
	return name.trim().toLowerCase() === FRIENDS_FEED_ROOM_NAME.toLowerCase();
}
