import { publishEventToRoom } from "../sync/RoomSyncService";
import { ensureFriendsFeedRoom } from "./FriendsFeedRoomService";

export async function publishEventToAllFriends(eventId: string): Promise<void> {
	const roomId = await ensureFriendsFeedRoom();
	await publishEventToRoom({ roomId, eventId });
}
