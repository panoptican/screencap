import { useCallback, useEffect, useState } from "react";

export interface AddictionStats {
	lastIncidentAt: number | null;
	weekCount: number;
	prevWeekCount: number;
	coverCandidates: string[];
}

function highResPathFromLowResPath(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (!path.endsWith(".webp")) return null;
	return path.replace(/\.webp$/, ".hq.png");
}

function toCandidates(item: {
	coverThumbnailPath: string | null;
	coverOriginalPath: string | null;
}): string[] {
	const candidates = [
		highResPathFromLowResPath(item.coverOriginalPath),
		item.coverOriginalPath,
		item.coverThumbnailPath,
	].filter((v): v is string => typeof v === "string" && v.length > 0);
	return [...new Set(candidates)];
}

export function useAddictionStats(addictionNames: string[]) {
	const [stats, setStats] = useState<Record<string, AddictionStats>>({});
	const [isLoading, setIsLoading] = useState(true);

	const fetchStats = useCallback(async () => {
		if (!window.api || addictionNames.length === 0) {
			setStats({});
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		const batch = await window.api.storage.getAddictionStatsBatch(addictionNames);

		const next: Record<string, AddictionStats> = {};
		for (const name of addictionNames) {
			const item = batch[name];
			if (item) {
				next[name] = {
					lastIncidentAt: item.lastIncidentAt,
					weekCount: item.weekCount,
					prevWeekCount: item.prevWeekCount,
					coverCandidates: toCandidates(item),
				};
			} else {
				next[name] = {
					lastIncidentAt: null,
					weekCount: 0,
					prevWeekCount: 0,
					coverCandidates: [],
				};
			}
		}

		setStats(next);
		setIsLoading(false);
	}, [addictionNames]);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	useEffect(() => {
		if (!window.api) return;

		const unsubscribeCreated = window.api.on("event:created", fetchStats);
		const unsubscribeUpdated = window.api.on("event:updated", fetchStats);
		const unsubscribeChanged = window.api.on("events:changed", fetchStats);

		return () => {
			unsubscribeCreated();
			unsubscribeUpdated();
			unsubscribeChanged();
		};
	}, [fetchStats]);

	return { stats, isLoading, refetch: fetchStats };
}
