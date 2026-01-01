import { getDatabase, isDbOpen } from "../connection";

export type WebsiteEntry = { host: string; faviconPath: string | null };

export function getFaviconPath(host: string): string | null {
	if (!isDbOpen()) return null;
	const db = getDatabase();
	const row = db
		.prepare("SELECT path FROM favicons WHERE host = ?")
		.get(host) as { path: string } | undefined;
	return row?.path ?? null;
}

export function upsertFavicon(
	host: string,
	path: string,
	updatedAt: number,
): void {
	if (!isDbOpen()) return;
	const db = getDatabase();
	db.prepare(`
    INSERT INTO favicons (host, path, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(host) DO UPDATE SET
      path = excluded.path,
      updated_at = excluded.updated_at
  `).run(host, path, updatedAt);
}

export function listWebsitesWithFavicons(): WebsiteEntry[] {
	if (!isDbOpen()) return [];
	const db = getDatabase();
	const rows = db
		.prepare(`
    SELECT
      e.url_host AS host,
      f.path AS favicon_path
    FROM events e
    LEFT JOIN favicons f ON f.host = e.url_host
    WHERE e.url_host IS NOT NULL AND e.dismissed = 0
    GROUP BY e.url_host
    ORDER BY e.url_host COLLATE NOCASE ASC
  `)
		.all() as Array<{ host: string; favicon_path: string | null }>;

	return rows.map((r) => ({ host: r.host, faviconPath: r.favicon_path }));
}

type DistinctWebsiteOptions = {
	startDate?: number;
	endDate?: number;
	dismissed?: boolean;
};

export function listWebsitesWithFaviconsInRange(
	options: DistinctWebsiteOptions,
): WebsiteEntry[] {
	if (!isDbOpen()) return [];
	const db = getDatabase();

	const conditions: string[] = ["e.url_host IS NOT NULL"];
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
      SELECT
        e.url_host AS host,
        f.path AS favicon_path
      FROM events e
      LEFT JOIN favicons f ON f.host = e.url_host
      WHERE ${conditions.join(" AND ")}
      GROUP BY e.url_host
      ORDER BY e.url_host COLLATE NOCASE ASC
    `,
		)
		.all(...params) as Array<{ host: string; favicon_path: string | null }>;

	return rows.map((r) => ({ host: r.host, faviconPath: r.favicon_path }));
}

export function listMissingFaviconHosts(limit: number): string[] {
	if (!isDbOpen()) return [];
	const db = getDatabase();
	const rows = db
		.prepare(`
    SELECT e.url_host AS host
    FROM events e
    LEFT JOIN favicons f ON f.host = e.url_host
    WHERE e.url_host IS NOT NULL AND e.dismissed = 0 AND f.host IS NULL
    GROUP BY e.url_host
    LIMIT ?
  `)
		.all(limit) as Array<{ host: string }>;
	return rows.map((r) => r.host);
}
