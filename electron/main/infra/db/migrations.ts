import type Database from "better-sqlite3";
import { SELF_APP_BUNDLE_ID } from "../../../shared/appIdentity";
import { createLogger } from "../log";

const logger = createLogger({ scope: "Migrations" });

type TableInfoRow = { name: string };

function getExistingColumns(db: Database.Database, table: string): Set<string> {
	const rows = db
		.prepare(`PRAGMA table_info(${table})`)
		.all() as TableInfoRow[];
	return new Set(rows.map((r) => r.name));
}

function addColumnIfMissing(
	db: Database.Database,
	table: string,
	column: string,
	definition: string,
	existing: Set<string>,
): boolean {
	if (existing.has(column)) return false;
	db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	logger.info(`Added column ${column} to ${table}`);
	return true;
}

export function runMigrations(db: Database.Database): void {
	logger.info("Running migrations");

	const eventsColumns = getExistingColumns(db, "events");

	addColumnIfMissing(
		db,
		"events",
		"addiction_candidate",
		"TEXT",
		eventsColumns,
	);
	addColumnIfMissing(
		db,
		"events",
		"addiction_confidence",
		"REAL",
		eventsColumns,
	);
	addColumnIfMissing(db, "events", "addiction_prompt", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "end_timestamp", "INTEGER", eventsColumns);
	addColumnIfMissing(db, "events", "stable_hash", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "detail_hash", "TEXT", eventsColumns);
	addColumnIfMissing(
		db,
		"events",
		"merged_count",
		"INTEGER DEFAULT 1",
		eventsColumns,
	);
	addColumnIfMissing(
		db,
		"events",
		"project_progress",
		"INTEGER DEFAULT 0",
		eventsColumns,
	);
	addColumnIfMissing(
		db,
		"events",
		"project_progress_confidence",
		"REAL",
		eventsColumns,
	);
	addColumnIfMissing(
		db,
		"events",
		"project_progress_evidence",
		"TEXT",
		eventsColumns,
	);

	addColumnIfMissing(db, "events", "app_bundle_id", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "app_name", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "window_title", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "url_host", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "url_canonical", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "content_kind", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "content_id", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "content_title", "TEXT", eventsColumns);
	addColumnIfMissing(
		db,
		"events",
		"is_fullscreen",
		"INTEGER DEFAULT 0",
		eventsColumns,
	);
	addColumnIfMissing(db, "events", "context_provider", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "context_confidence", "REAL", eventsColumns);
	addColumnIfMissing(db, "events", "context_key", "TEXT", eventsColumns);
	addColumnIfMissing(db, "events", "context_json", "TEXT", eventsColumns);

	db.exec(
		"UPDATE events SET end_timestamp = timestamp WHERE end_timestamp IS NULL",
	);
	db.exec("UPDATE events SET merged_count = 1 WHERE merged_count IS NULL");
	db.exec(
		"UPDATE events SET project_progress = 0 WHERE project_progress IS NULL",
	);

	const clearedAddictionSignals = db
		.prepare(
			`
      UPDATE events
      SET
        tracked_addiction = NULL,
        addiction_candidate = NULL,
        addiction_confidence = NULL,
        addiction_prompt = NULL
      WHERE app_bundle_id = ?
        AND (
          tracked_addiction IS NOT NULL OR
          addiction_candidate IS NOT NULL OR
          addiction_confidence IS NOT NULL OR
          addiction_prompt IS NOT NULL
        )
    `,
		)
		.run(SELF_APP_BUNDLE_ID).changes;
	if (clearedAddictionSignals > 0) {
		logger.info(
			`Cleared addiction signals for ${clearedAddictionSignals} self captures`,
		);
	}

	const memoryColumns = getExistingColumns(db, "memory");
	addColumnIfMissing(db, "memory", "description", "TEXT", memoryColumns);

	logger.info("Migrations complete");
}
