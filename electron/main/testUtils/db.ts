export async function initTestDb(): Promise<void> {
	const { createIndexes, createTables, openDatabase, runMigrations } =
		await import("../infra/db");
	const db = openDatabase();
	createTables(db);
	runMigrations(db);
	createIndexes(db);
}

export async function closeTestDb(): Promise<void> {
	const { closeDatabase } = await import("../infra/db");
	closeDatabase();
}
