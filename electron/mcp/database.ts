import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const DEFAULT_DB_PATH = join(
	homedir(),
	"Library/Application Support/Screencap/screencap.db",
);

let cachedDb: Database.Database | null = null;

export function getDbPath(): string {
	return process.env.SCREENCAP_DB_PATH ?? DEFAULT_DB_PATH;
}

export function getDatabase(): Database.Database {
	if (cachedDb) {
		return cachedDb;
	}

	const dbPath = getDbPath();

	if (!existsSync(dbPath)) {
		throw new Error(
			`Screencap database not found at ${dbPath}. Make sure Screencap is installed and has been run at least once.`,
		);
	}

	cachedDb = new Database(dbPath, { readonly: true });
	return cachedDb;
}

export function closeDatabase(): void {
	if (cachedDb) {
		cachedDb.close();
		cachedDb = null;
	}
}

export function getDayStart(date: Date = new Date()): number {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export function getDayEnd(date: Date = new Date()): number {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d.getTime();
}

export function getWeekStart(date: Date = new Date()): number {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	d.setDate(diff);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export function getHoursAgo(hours: number): number {
	return Date.now() - hours * 60 * 60 * 1000;
}

export function getDaysAgo(days: number): number {
	return Date.now() - days * 24 * 60 * 60 * 1000;
}
