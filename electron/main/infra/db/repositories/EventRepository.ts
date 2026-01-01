import { existsSync, unlinkSync } from "node:fs";
import type {
	Event,
	GetEventsOptions,
	LatestEventByDisplayId,
} from "../../../../shared/types";
import { createLogger } from "../../log";
import { getDatabase, isDbOpen } from "../connection";
import { toSnakeCase, transformRow, transformRows } from "../transformers";
import {
	deleteEventScreenshots,
	getEventScreenshotPaths,
} from "./EventScreenshotRepository";

const logger = createLogger({ scope: "EventRepository" });

type RawEventRow = Record<string, unknown>;

function highResPathFromLowResPath(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (!path.endsWith(".webp")) return null;
	return path.replace(/\.webp$/, ".hq.png");
}

function safeUnlink(
	path: string | null | undefined,
	context: { id: string; kind: string },
): void {
	if (!path) return;
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {
		logger.warn(`Failed to delete ${context.kind} file`, {
			id: context.id,
			path,
		});
	}
}

export function insertEvent(event: Partial<Event>): void {
	if (!isDbOpen()) {
		logger.error("Cannot insert event - database not open");
		return;
	}

	const db = getDatabase();
	logger.debug("Inserting event:", { id: event.id });

	const stmt = db.prepare(`
    INSERT INTO events (
      id, timestamp, end_timestamp, display_id, category, subcategories, 
      project, project_progress, project_progress_confidence, project_progress_evidence,
      tags, confidence, caption, tracked_addiction, 
      addiction_candidate, addiction_confidence, addiction_prompt,
      thumbnail_path, original_path, stable_hash, detail_hash, 
      merged_count, dismissed, user_label, status,
      app_bundle_id, app_name, window_title, url_host, url_canonical,
      content_kind, content_id, content_title, is_fullscreen,
      context_provider, context_confidence, context_key, context_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

	stmt.run(
		event.id,
		event.timestamp,
		event.endTimestamp ?? event.timestamp,
		event.displayId ?? null,
		event.category ?? null,
		event.subcategories ?? null,
		event.project ?? null,
		event.projectProgress ?? 0,
		event.projectProgressConfidence ?? null,
		null,
		event.tags ?? null,
		event.confidence ?? null,
		event.caption ?? null,
		event.trackedAddiction ?? null,
		event.addictionCandidate ?? null,
		event.addictionConfidence ?? null,
		event.addictionPrompt ?? null,
		event.thumbnailPath ?? null,
		event.originalPath ?? null,
		event.stableHash ?? null,
		event.detailHash ?? null,
		event.mergedCount ?? 1,
		event.dismissed ?? 0,
		event.userLabel ?? null,
		event.status ?? "pending",
		event.appBundleId ?? null,
		event.appName ?? null,
		event.windowTitle ?? null,
		event.urlHost ?? null,
		event.urlCanonical ?? null,
		event.contentKind ?? null,
		event.contentId ?? null,
		event.contentTitle ?? null,
		event.isFullscreen ?? 0,
		event.contextProvider ?? null,
		event.contextConfidence ?? null,
		event.contextKey ?? null,
		event.contextJson ?? null,
	);
}

export function getEventById(id: string): Event | null {
	if (!isDbOpen()) return null;
	const db = getDatabase();
	const row = db
		.prepare(`
    SELECT
      e.*,
      f.path AS favicon_path,
      (SELECT COUNT(*) FROM event_screenshots es WHERE es.event_id = e.id) AS screenshot_count
    FROM events e
    LEFT JOIN favicons f ON f.host = e.url_host
    WHERE e.id = ?
  `)
		.get(id) as RawEventRow | undefined;
	return row ? transformRow<Event>(row) : null;
}

export function getEvents(options: GetEventsOptions): Event[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	const conditions: string[] = ["1=1"];
	const params: unknown[] = [];

	if (options.category) {
		conditions.push("e.category = ?");
		params.push(options.category);
	}

	if (options.project) {
		conditions.push("e.project = ?");
		params.push(options.project);
	}

	if (options.projectProgress !== undefined) {
		conditions.push("e.project_progress = ?");
		params.push(options.projectProgress ? 1 : 0);
	}

	if (options.appBundleId) {
		conditions.push("e.app_bundle_id = ?");
		params.push(options.appBundleId);
	}

	if (options.urlHost) {
		conditions.push("e.url_host = ?");
		params.push(options.urlHost);
	}

	if (options.startDate) {
		conditions.push("e.timestamp >= ?");
		params.push(options.startDate);
	}

	if (options.endDate) {
		conditions.push("e.timestamp <= ?");
		params.push(options.endDate);
	}

	if (options.search) {
		conditions.push("(e.caption LIKE ? OR e.tags LIKE ?)");
		params.push(`%${options.search}%`, `%${options.search}%`);
	}

	if (options.dismissed === undefined) {
		conditions.push("e.dismissed = 0");
	} else {
		conditions.push("e.dismissed = ?");
		params.push(options.dismissed ? 1 : 0);
	}

	let query = `
    SELECT
      e.*,
      f.path AS favicon_path,
      (SELECT COUNT(*) FROM event_screenshots es WHERE es.event_id = e.id) AS screenshot_count
    FROM events e
    LEFT JOIN favicons f ON f.host = e.url_host
    WHERE ${conditions.join(" AND ")}
    ORDER BY e.timestamp DESC
  `;

	if (options.limit) {
		query += " LIMIT ?";
		params.push(options.limit);
	}

	if (options.offset) {
		query += " OFFSET ?";
		params.push(options.offset);
	}

	const rows = db.prepare(query).all(...params) as RawEventRow[];
	return transformRows<Event>(rows);
}

export function listExpiredEventIds(
	cutoffTimestamp: number,
	limit: number,
): string[] {
	if (!isDbOpen()) return [];
	if (limit <= 0) return [];

	const db = getDatabase();
	const rows = db
		.prepare(
			`
      SELECT id
      FROM events
      WHERE COALESCE(end_timestamp, timestamp) < ?
      ORDER BY timestamp ASC
      LIMIT ?
    `,
		)
		.all(cutoffTimestamp, limit) as Array<{ id: string }>;

	return rows.map((r) => r.id);
}

export function updateEvent(id: string, updates: Partial<Event>): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	const fields = Object.keys(updates)
		.map((key) => `${toSnakeCase(key)} = ?`)
		.join(", ");
	const values = Object.values(updates);

	db.prepare(`UPDATE events SET ${fields} WHERE id = ?`).run(...values, id);
}

export function dismissEvents(ids: string[]): void {
	if (!isDbOpen() || ids.length === 0) return;

	const db = getDatabase();
	const placeholders = ids.map(() => "?").join(",");
	db.prepare(
		`UPDATE events SET dismissed = 1 WHERE id IN (${placeholders})`,
	).run(...ids);
}

export function relabelEvents(ids: string[], label: string): void {
	if (!isDbOpen() || ids.length === 0) return;

	const db = getDatabase();
	const placeholders = ids.map(() => "?").join(",");
	db.prepare(
		`UPDATE events SET user_label = ? WHERE id IN (${placeholders})`,
	).run(label, ...ids);
}

export function confirmAddiction(ids: string[]): void {
	if (!isDbOpen() || ids.length === 0) return;

	const db = getDatabase();
	const placeholders = ids.map(() => "?").join(",");
	db.prepare(
		`UPDATE events SET tracked_addiction = addiction_candidate, addiction_candidate = NULL WHERE id IN (${placeholders})`,
	).run(...ids);
}

export function rejectAddiction(ids: string[]): void {
	if (!isDbOpen() || ids.length === 0) return;

	const db = getDatabase();
	const placeholders = ids.map(() => "?").join(",");
	db.prepare(
		`UPDATE events SET tracked_addiction = NULL, addiction_candidate = NULL WHERE id IN (${placeholders})`,
	).run(...ids);
}

export function deleteEvent(id: string): void {
	if (!isDbOpen()) return;

	const db = getDatabase();
	const event = db
		.prepare("SELECT thumbnail_path, original_path FROM events WHERE id = ?")
		.get(id) as
		| { thumbnail_path: string | null; original_path: string | null }
		| undefined;
	const screenshotFiles = getEventScreenshotPaths(id);

	const deleteTx = db.transaction((eventId: string) => {
		db.prepare("DELETE FROM queue WHERE event_id = ?").run(eventId);
		deleteEventScreenshots(eventId);
		db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
	});

	deleteTx(id);

	for (const file of screenshotFiles) {
		safeUnlink(file.thumbnailPath, { id, kind: "screenshot thumbnail" });
		safeUnlink(file.originalPath, { id, kind: "screenshot original" });
		safeUnlink(highResPathFromLowResPath(file.originalPath), {
			id,
			kind: "screenshot high-res",
		});
	}

	if (event?.thumbnail_path) {
		safeUnlink(event.thumbnail_path, { id, kind: "thumbnail" });
	}

	if (event?.original_path) {
		safeUnlink(event.original_path, { id, kind: "original" });
		safeUnlink(highResPathFromLowResPath(event.original_path), {
			id,
			kind: "high-res",
		});
	}
}

export function getLatestEventByDisplayId(
	displayId: string,
): LatestEventByDisplayId | null {
	if (!isDbOpen()) return null;

	const db = getDatabase();
	const row = db
		.prepare(`
    SELECT id, timestamp, end_timestamp, display_id, stable_hash, detail_hash, original_path, merged_count, context_key 
    FROM events 
    WHERE display_id = ? AND dismissed = 0
    ORDER BY timestamp DESC 
    LIMIT 1
  `)
		.get(displayId) as RawEventRow | undefined;

	return row ? transformRow<LatestEventByDisplayId>(row) : null;
}

export function getDistinctCategories(): string[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	const rows = db
		.prepare("SELECT DISTINCT category FROM events WHERE category IS NOT NULL")
		.all() as { category: string }[];
	return rows.map((r) => r.category);
}

export function getDistinctProjects(): string[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	const rows = db
		.prepare(
			"SELECT DISTINCT project FROM events WHERE project IS NOT NULL ORDER BY project COLLATE NOCASE ASC",
		)
		.all() as { project: string }[];
	return rows.map((r) => r.project);
}

type DistinctFacetOptions = {
	startDate?: number;
	endDate?: number;
	dismissed?: boolean;
};

export function getDistinctProjectsInRange(
	options: DistinctFacetOptions,
): string[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	const conditions: string[] = ["e.project IS NOT NULL"];
	const params: unknown[] = [];

	if (options.startDate != null) {
		conditions.push("e.timestamp >= ?");
		params.push(options.startDate);
	}

	if (options.endDate != null) {
		conditions.push("e.timestamp <= ?");
		params.push(options.endDate);
	}

	if (options.dismissed === undefined) {
		conditions.push("e.dismissed = 0");
	} else {
		conditions.push("e.dismissed = ?");
		params.push(options.dismissed ? 1 : 0);
	}

	const rows = db
		.prepare(
			`
      SELECT DISTINCT e.project AS project
      FROM events e
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.project COLLATE NOCASE ASC
    `,
		)
		.all(...params) as { project: string }[];

	return rows.map((r) => r.project);
}

export function getCategoryStats(
	startDate: number,
	endDate: number,
): { category: string; count: number }[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	return db
		.prepare(`
    SELECT category, COUNT(*) as count 
    FROM events 
    WHERE timestamp >= ? AND timestamp <= ? AND dismissed = 0
    GROUP BY category
  `)
		.all(startDate, endDate) as { category: string; count: number }[];
}

export function getProjectCounts(): { project: string; count: number }[] {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	return db
		.prepare(
			"SELECT project, COUNT(*) as count FROM events WHERE project IS NOT NULL GROUP BY project",
		)
		.all() as { project: string; count: number }[];
}

export function updateProjectName(oldName: string, newName: string): number {
	if (!isDbOpen()) return 0;

	const db = getDatabase();
	const result = db
		.prepare("UPDATE events SET project = ? WHERE project = ?")
		.run(newName, oldName);
	return result.changes;
}

export function getDistinctAppsInRange(
	options: DistinctFacetOptions,
): Array<{ bundleId: string; name: string | null }> {
	if (!isDbOpen()) return [];

	const db = getDatabase();
	const conditions: string[] = ["e.app_bundle_id IS NOT NULL"];
	const params: unknown[] = [];

	if (options.startDate != null) {
		conditions.push("e.timestamp >= ?");
		params.push(options.startDate);
	}

	if (options.endDate != null) {
		conditions.push("e.timestamp <= ?");
		params.push(options.endDate);
	}

	if (options.dismissed === undefined) {
		conditions.push("e.dismissed = 0");
	} else {
		conditions.push("e.dismissed = ?");
		params.push(options.dismissed ? 1 : 0);
	}

	return db
		.prepare(
			`
      SELECT
        e.app_bundle_id as bundleId,
        MAX(e.app_name) as name
      FROM events e
      WHERE ${conditions.join(" AND ")}
      GROUP BY e.app_bundle_id
      ORDER BY COALESCE(MAX(e.app_name), e.app_bundle_id) COLLATE NOCASE ASC
    `,
		)
		.all(...params) as Array<{ bundleId: string; name: string | null }>;
}

export function getDistinctApps(): Array<{
	bundleId: string;
	name: string | null;
}> {
	return getDistinctAppsInRange({});
}
