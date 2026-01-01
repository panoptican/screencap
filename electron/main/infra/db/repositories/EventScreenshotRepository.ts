import type { EventScreenshot } from "../../../../shared/types";
import { getDatabase, getDatabaseOrNull, isDbOpen } from "../connection";

type RawEventScreenshotRow = {
	id: string;
	event_id: string;
	display_id: string;
	is_primary: number;
	thumbnail_path: string;
	original_path: string;
	stable_hash: string | null;
	detail_hash: string | null;
	width: number;
	height: number;
	timestamp: number;
};

export type InsertEventScreenshot = {
	id: string;
	eventId: string;
	displayId: string;
	isPrimary: boolean;
	thumbnailPath: string;
	originalPath: string;
	stableHash: string | null;
	detailHash: string | null;
	width: number;
	height: number;
	timestamp: number;
};

function toEventScreenshot(row: RawEventScreenshotRow): EventScreenshot {
	return {
		id: row.id,
		eventId: row.event_id,
		displayId: row.display_id,
		isPrimary: row.is_primary === 1,
		thumbnailPath: row.thumbnail_path,
		originalPath: row.original_path,
		stableHash: row.stable_hash,
		detailHash: row.detail_hash,
		width: row.width,
		height: row.height,
		timestamp: row.timestamp,
	};
}

export function insertEventScreenshots(items: InsertEventScreenshot[]): void {
	const db = getDatabaseOrNull();
	if (!db || items.length === 0) return;

	const stmt = db.prepare(`
    INSERT INTO event_screenshots (
      id, event_id, display_id, is_primary, thumbnail_path, original_path,
      stable_hash, detail_hash, width, height, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	const tx = db.transaction((rows: InsertEventScreenshot[]) => {
		for (const s of rows) {
			stmt.run(
				s.id,
				s.eventId,
				s.displayId,
				s.isPrimary ? 1 : 0,
				s.thumbnailPath,
				s.originalPath,
				s.stableHash,
				s.detailHash,
				s.width,
				s.height,
				s.timestamp,
			);
		}
	});

	tx(items);
}

export function getEventScreenshots(eventId: string): EventScreenshot[] {
	if (!isDbOpen()) return [];
	const db = getDatabase();

	const rows = db
		.prepare(`
    SELECT *
    FROM event_screenshots
    WHERE event_id = ?
    ORDER BY is_primary DESC, display_id ASC
  `)
		.all(eventId) as RawEventScreenshotRow[];

	return rows.map(toEventScreenshot);
}

export function getEventScreenshotPaths(
	eventId: string,
): Array<{ thumbnailPath: string; originalPath: string }> {
	if (!isDbOpen()) return [];
	const db = getDatabase();
	const rows = db
		.prepare(`
    SELECT thumbnail_path, original_path
    FROM event_screenshots
    WHERE event_id = ?
  `)
		.all(eventId) as Array<{ thumbnail_path: string; original_path: string }>;

	return rows.map((r) => ({
		thumbnailPath: r.thumbnail_path,
		originalPath: r.original_path,
	}));
}

export function deleteEventScreenshots(eventId: string): void {
	if (!isDbOpen()) return;
	const db = getDatabase();
	db.prepare("DELETE FROM event_screenshots WHERE event_id = ?").run(eventId);
}
