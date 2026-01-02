import { getDatabase, isDbOpen } from "../connection";

export function getAppIconPath(bundleId: string): string | null {
	if (!isDbOpen()) return null;
	const db = getDatabase();
	const row = db
		.prepare("SELECT path FROM app_icons WHERE bundle_id = ?")
		.get(bundleId) as { path: string } | undefined;
	return row?.path ?? null;
}

export function upsertAppIcon(
	bundleId: string,
	path: string,
	updatedAt: number,
): void {
	if (!isDbOpen()) return;
	const db = getDatabase();
	db.prepare(`
    INSERT INTO app_icons (bundle_id, path, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(bundle_id) DO UPDATE SET
      path = excluded.path,
      updated_at = excluded.updated_at
  `).run(bundleId, path, updatedAt);
}
