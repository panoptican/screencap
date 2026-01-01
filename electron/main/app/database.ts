import { normalizeProjectsInDb } from "../features/projects";
import {
	createIndexes,
	createTables,
	openDatabase,
	runMigrations,
} from "../infra/db";
import { createLogger } from "../infra/log";
import { broadcastProjectsNormalized } from "../infra/windows";

const logger = createLogger({ scope: "DatabaseInit" });

export function initializeDatabase(): void {
	logger.info("Initializing database");

	const db = openDatabase();
	createTables(db);
	runMigrations(db);
	createIndexes(db);

	const projectMerge = normalizeProjectsInDb();
	if (projectMerge.updatedRows > 0) {
		logger.info("Normalized projects on startup", projectMerge);
		broadcastProjectsNormalized(projectMerge);
	}

	logger.info("Database initialized");
}
