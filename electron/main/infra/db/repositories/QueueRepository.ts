import type { QueueItem } from "../../../../shared/types";
import { getDatabase, getDatabaseOrNull, isDbOpen } from "../connection";

const MAX_ATTEMPTS = 3;

type RawQueueRow = {
	id: string;
	event_id: string;
	attempts: number;
	created_at: number;
	next_attempt_at: number;
};

function transformQueueRow(row: RawQueueRow): QueueItem {
	return {
		id: row.id,
		eventId: row.event_id,
		attempts: row.attempts,
		createdAt: row.created_at,
		nextAttemptAt: row.next_attempt_at,
	};
}

function retryDelayMs(attempts: number): number {
	if (attempts <= 1) return 30_000;
	if (attempts === 2) return 2 * 60_000;
	return 10 * 60_000;
}

export function addToQueue(eventId: string): void {
	const db = getDatabaseOrNull();
	if (!db) return;

	const id = crypto.randomUUID();
	const now = Date.now();
	db.prepare(`
    INSERT INTO queue (id, event_id, attempts, created_at, next_attempt_at)
    VALUES (?, ?, 0, ?, ?)
  `).run(id, eventId, now, now);
}

export function isEventQueued(eventId: string): boolean {
	const db = getDatabaseOrNull();
	if (!db) return false;
	const row = db
		.prepare("SELECT 1 as ok FROM queue WHERE event_id = ? LIMIT 1")
		.get(eventId) as { ok: 1 } | undefined;
	return !!row;
}

export function removeFromQueue(id: string): void {
	const db = getDatabaseOrNull();
	if (!db) return;

	db.prepare("DELETE FROM queue WHERE id = ?").run(id);
}

export function getQueueItems(limit?: number): QueueItem[] {
	const db = getDatabaseOrNull();
	if (!db) return [];

	let query =
		"SELECT * FROM queue WHERE attempts < ? ORDER BY next_attempt_at ASC, created_at ASC";
	const params: unknown[] = [MAX_ATTEMPTS];

	if (limit) {
		query += " LIMIT ?";
		params.push(limit);
	}

	const rows = db.prepare(query).all(...params) as RawQueueRow[];
	return rows.map(transformQueueRow);
}

export function getDueQueueItems(limit?: number): QueueItem[] {
	const db = getDatabaseOrNull();
	if (!db) return [];

	let query =
		"SELECT * FROM queue WHERE attempts < ? AND next_attempt_at <= ? ORDER BY next_attempt_at ASC, created_at ASC";
	const params: unknown[] = [MAX_ATTEMPTS, Date.now()];

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
	const current = db
		.prepare("SELECT attempts FROM queue WHERE id = ?")
		.get(id) as { attempts: number } | undefined;
	if (!current) return 0;

	const attempts = current.attempts + 1;
	const nextAttemptAt = Date.now() + retryDelayMs(attempts);

	db.prepare(
		"UPDATE queue SET attempts = ?, next_attempt_at = ? WHERE id = ?",
	).run(attempts, nextAttemptAt, id);

	return attempts;
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
