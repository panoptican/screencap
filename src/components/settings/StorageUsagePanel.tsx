import {
	AlertCircle,
	FolderOpen,
	Loader2,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/wrapped/Panel";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import type {
	ClearableStorageCategory,
	StorageUsageBreakdown,
	StorageUsageEntry,
} from "@/types";

type LoadStatus = "idle" | "loading" | "success" | "error";

function isClearableCategory(key: string): key is ClearableStorageCategory {
	return ["tmp", "thumbnails", "appicons", "favicons", "hq", "other"].includes(
		key,
	);
}

export function StorageUsagePanel() {
	const [status, setStatus] = useState<LoadStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<StorageUsageBreakdown | null>(null);
	const [clearing, setClearing] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!window.api) return;
		setStatus("loading");
		setError(null);
		try {
			const next = await window.api.storage.getDiskUsage();
			setData(next);
			setStatus("success");
		} catch (e) {
			setError(String(e));
			setStatus("error");
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const handleClear = useCallback(
		async (entry: StorageUsageEntry) => {
			if (!window.api || !entry.clearable) return;
			if (!isClearableCategory(entry.key)) return;

			setClearing(entry.key);
			try {
				await window.api.storage.clearStorageCategory(entry.key);
				await refresh();
			} finally {
				setClearing(null);
			}
		},
		[refresh],
	);

	const handleReveal = useCallback(async (entry: StorageUsageEntry) => {
		if (!window.api) return;
		await window.api.storage.revealStorageCategory(entry.key);
	}, []);

	const meta = useMemo(() => {
		if (!data)
			return status === "loading" ? "Calculating..." : "Current breakdown";
		return `Total ${formatBytes(data.totalBytes)} · ${formatRelativeTime(data.computedAt)}`;
	}, [data, status]);

	const entries = data?.entries ?? [];

	return (
		<Panel
			title="Disk usage"
			meta={meta}
			className="max-w-3xl"
			right={
				<Button
					variant="ghost"
					size="sm"
					onClick={refresh}
					disabled={status === "loading"}
					className="h-7 px-2"
				>
					{status === "loading" ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<RefreshCw className="h-3.5 w-3.5" />
					)}
				</Button>
			}
		>
			{status === "error" ? (
				<div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
					<AlertCircle className="h-3.5 w-3.5" />
					<span>{error ?? "Failed to load"}</span>
				</div>
			) : null}

			{data ? (
				<div className="overflow-x-auto">
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b border-border/50">
								<th className="text-left font-medium text-muted-foreground py-1.5 pr-4">
									Category
								</th>
								<th className="text-right font-medium text-muted-foreground py-1.5 px-2">
									Size
								</th>
								<th className="w-14" />
							</tr>
						</thead>
						<tbody>
							{entries.map((entry) => (
								<tr
									key={entry.key}
									className="border-b border-border/30 last:border-0"
								>
									<td className="py-1.5 pr-4">
										<span className="text-foreground">{entry.label}</span>
									</td>
									<td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
										{formatBytes(entry.bytes)}
									</td>
									<td className="py-1 w-14">
										<div className="flex items-center justify-end">
											<Button
												variant="ghost"
												size="sm"
												className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
												onClick={() => handleReveal(entry)}
												title="Reveal in Finder"
											>
												<FolderOpen className="size-3" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className={`h-5 w-5 p-0 ${entry.clearable && entry.bytes > 0 ? "text-muted-foreground hover:text-destructive" : "invisible"}`}
												onClick={() => handleClear(entry)}
												disabled={
													clearing === entry.key ||
													!entry.clearable ||
													entry.bytes === 0
												}
												title={`Clear ${entry.label.toLowerCase()}`}
											>
												{clearing === entry.key ? (
													<Loader2 className="size-3 animate-spin" />
												) : (
													<Trash2 className="size-3" />
												)}
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
						<tfoot>
							<tr className="border-t border-border/50">
								<td className="py-1.5 pr-4 font-medium">Total</td>
								<td className="py-1.5 px-2 text-right font-mono font-medium">
									{formatBytes(data.totalBytes)}
								</td>
								<td className="w-14" />
							</tr>
						</tfoot>
					</table>
				</div>
			) : status === "loading" ? (
				<div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					Calculating...
				</div>
			) : null}
		</Panel>
	);
}
