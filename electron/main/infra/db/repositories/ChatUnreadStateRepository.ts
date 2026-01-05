import { getDatabase, isDbOpen } from "../connection";

type ChatUnreadStateRow = {
	thread_id: string;
	last_read_timestamp_ms: number;
	updated_at: number;
};

export function getChatLastReadTimestampMs(threadId: string): number {
	if (!isDbOpen()) return 0;
	const db = getDatabase();
	const row = db
		.prepare(
			`SELECT last_read_timestamp_ms
       FROM chat_unread_state
       WHERE thread_id = ?`,
		)
		.get(threadId) as
		| Pick<ChatUnreadStateRow, "last_read_timestamp_ms">
		| undefined;
	return Math.max(0, row?.last_read_timestamp_ms ?? 0);
}

export function upsertChatLastReadTimestampMs(params: {
	threadId: string;
	lastReadTimestampMs: number;
	updatedAt: number;
}): void {
	if (!isDbOpen()) return;
	const db = getDatabase();
	db.prepare(
		`INSERT INTO chat_unread_state (thread_id, last_read_timestamp_ms, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (thread_id) DO UPDATE SET
       last_read_timestamp_ms = excluded.last_read_timestamp_ms,
       updated_at = excluded.updated_at`,
	).run(
		params.threadId,
		Math.max(0, Math.trunc(params.lastReadTimestampMs)),
		Math.max(0, Math.trunc(params.updatedAt)),
	);
}
