import type { Memory } from "../../../../shared/types";
import { getDatabase, isDbOpen } from "../connection";
import { transformRows } from "../transformers";

type RawMemoryRow = Record<string, unknown>;

export function getMemories(type?: string): Memory[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	let rows: RawMemoryRow[];

	if (type) {
		rows = db
			.prepare("SELECT * FROM memory WHERE type = ? ORDER BY updated_at DESC")
			.all(type) as RawMemoryRow[];
	} else {
		rows = db
			.prepare("SELECT * FROM memory ORDER BY updated_at DESC")
			.all() as RawMemoryRow[];
	}

	return transformRows<Memory>(rows);
}

export function insertMemory(memory: Memory): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	db.prepare(`
    INSERT INTO memory (id, type, content, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
		memory.id,
		memory.type,
		memory.content,
		memory.description ?? null,
		memory.createdAt,
		memory.updatedAt,
	);
}

export function updateMemory(
	id: string,
	updates: { content: string; description?: string | null },
): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	const updatedAt = Date.now();
	if (updates.description === undefined) {
		db.prepare(
			"UPDATE memory SET content = ?, updated_at = ? WHERE id = ?",
		).run(updates.content, updatedAt, id);
		return;
	}

	db.prepare(
		"UPDATE memory SET content = ?, description = ?, updated_at = ? WHERE id = ?",
	).run(updates.content, updates.description, updatedAt, id);
}

export function deleteMemory(id: string): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	db.prepare("DELETE FROM memory WHERE id = ?").run(id);
}

export function getMemoryById(id: string): Memory | null {
	if (!isDbOpen()) return null;

	const db = getDatabase();
	const row = db.prepare("SELECT * FROM memory WHERE id = ?").get(id) as
		| RawMemoryRow
		| undefined;
	if (!row) return null;

	return transformRows<Memory>([row])[0];
}

export function getMemoryType(id: string): string | null {
	if (!isDbOpen()) return null;

	const db = getDatabase();
	const row = db.prepare("SELECT type FROM memory WHERE id = ?").get(id) as
		| { type?: string }
		| undefined;
	return row?.type ?? null;
}

export function getProjectMemories(): Memory[] {
	return getMemories("project");
}

export function getAddictionMemories(): Memory[] {
	return getMemories("addiction");
}
