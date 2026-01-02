import { useCallback, useEffect, useState } from "react";

export interface ProjectStats {
	eventCount: number;
	lastEventAt: number | null;
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
	coverProjectProgress: number;
}): string[] {
	const candidates = [
		item.coverProjectProgress === 1
			? highResPathFromLowResPath(item.coverOriginalPath)
			: null,
		item.coverOriginalPath,
		item.coverThumbnailPath,
	].filter((v): v is string => typeof v === "string" && v.length > 0);
	return [...new Set(candidates)];
}

export function useProjectStats(projectNames: string[]) {
	const [stats, setStats] = useState<Record<string, ProjectStats>>({});
	const [isLoading, setIsLoading] = useState(true);

	const fetchStats = useCallback(async () => {
		if (!window.api || projectNames.length === 0) {
			setStats({});
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		const batch = await window.api.storage.getProjectStatsBatch(projectNames);

		const newStats: Record<string, ProjectStats> = {};
		for (const name of projectNames) {
			const item = batch[name];
			if (item) {
				newStats[name] = {
					eventCount: item.eventCount,
					lastEventAt: item.lastEventAt,
					coverCandidates: toCandidates(item),
				};
			} else {
				newStats[name] = {
					eventCount: 0,
					lastEventAt: null,
					coverCandidates: [],
				};
			}
		}

		setStats(newStats);
		setIsLoading(false);
	}, [projectNames]);

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
