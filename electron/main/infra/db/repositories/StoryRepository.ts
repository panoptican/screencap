import type { Story, StoryInput } from "../../../../shared/types";
import { getDatabase, isDbOpen } from "../connection";
import { transformRows } from "../transformers";

type RawStoryRow = Record<string, unknown>;

export function getStories(periodType?: string): Story[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	let rows: RawStoryRow[];

	if (periodType) {
		rows = db
			.prepare(
				"SELECT * FROM stories WHERE period_type = ? ORDER BY period_start DESC",
			)
			.all(periodType) as RawStoryRow[];
	} else {
		rows = db
			.prepare("SELECT * FROM stories ORDER BY period_start DESC")
			.all() as RawStoryRow[];
	}

	return transformRows<Story>(rows);
}

export function insertStory(story: StoryInput): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	const existing = db
		.prepare(
			"SELECT id FROM stories WHERE period_type = ? AND period_start = ? LIMIT 1",
		)
		.get(story.periodType, story.periodStart) as { id: string } | undefined;

	if (existing) {
		db.prepare(`
      UPDATE stories 
      SET period_end = ?, content = ?, created_at = ?
      WHERE id = ?
    `).run(story.periodEnd, story.content, story.createdAt, existing.id);
		return;
	}

	db.prepare(`
    INSERT INTO stories (id, period_type, period_start, period_end, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
		story.id,
		story.periodType,
		story.periodStart,
		story.periodEnd,
		story.content,
		story.createdAt,
	);
}

export function getStoryById(id: string): Story | null {
	if (!isDbOpen()) return null;

	const db = getDatabase();
	const row = db.prepare("SELECT * FROM stories WHERE id = ?").get(id) as
		| RawStoryRow
		| undefined;
	if (!row) return null;

	return transformRows<Story>([row])[0];
}

export function deleteStory(id: string): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	db.prepare("DELETE FROM stories WHERE id = ?").run(id);
}
