import type { QueueItem } from "../../../../shared/types";
import { getDatabase, getDatabaseOrNull, isDbOpen } from "../connection";

const MAX_ATTEMPTS = 3;

type RawQueueRow = {
	id: string;
	event_id: string;
	image_data: string;
	attempts: number;
	created_at: number;
};

function transformQueueRow(row: RawQueueRow): QueueItem {
	return {
		id: row.id,
		eventId: row.event_id,
		imageData: row.image_data,
		attempts: row.attempts,
		createdAt: row.created_at,
	};
}

export function addToQueue(eventId: string, imageBase64: string): void {
	const db = getDatabaseOrNull();
	if (!db) return;

	const id = crypto.randomUUID();
	db.prepare(`
    INSERT INTO queue (id, event_id, image_data, attempts, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(id, eventId, imageBase64, Date.now());
}

export function removeFromQueue(id: string): void {
	const db = getDatabaseOrNull();
	if (!db) return;

	db.prepare("DELETE FROM queue WHERE id = ?").run(id);
}

export function getQueueItems(limit?: number): QueueItem[] {
	const db = getDatabaseOrNull();
	if (!db) return [];

	let query = "SELECT * FROM queue WHERE attempts < ? ORDER BY created_at ASC";
	const params: unknown[] = [MAX_ATTEMPTS];

	if (limit) {
		query += " LIMIT ?";
		params.push(limit);
	}

	const rows = db.prepare(query).all(...params) as RawQueueRow[];
	return rows.map(transformQueueRow);
}

export function incrementAttempts(id: string): number {
	if (!isDbOpen()) return 0;

	const db = getDatabase();
	db.prepare("UPDATE queue SET attempts = attempts + 1 WHERE id = ?").run(id);
	const row = db.prepare("SELECT attempts FROM queue WHERE id = ?").get(id) as
		| { attempts: number }
		| undefined;
	return row?.attempts ?? 0;
}

export function getQueueItemById(id: string): QueueItem | null {
	const db = getDatabaseOrNull();
	if (!db) return null;

	const row = db.prepare("SELECT * FROM queue WHERE id = ?").get(id) as
		| RawQueueRow
		| undefined;
	return row ? transformQueueRow(row) : null;
}

export function getQueueSize(): number {
	const db = getDatabaseOrNull();
	if (!db) return 0;

	const row = db
		.prepare("SELECT COUNT(*) as count FROM queue WHERE attempts < ?")
		.get(MAX_ATTEMPTS) as { count: number };
	return row.count;
}

export function clearQueue(): void {
	const db = getDatabaseOrNull();
	if (!db) return;

	db.prepare("DELETE FROM queue").run();
}

export { MAX_ATTEMPTS };
