import { Flame, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { AddictionStats } from "@/hooks/useAddictionStats";
import { formatDurationCompact, formatRelativeTime } from "@/lib/utils";
import type { Memory } from "@/types";

interface AddictionCardProps {
	addiction: Memory;
	stats?: AddictionStats;
	onClick: () => void;
}

function formatSignedInt(value: number): string {
	return `${value >= 0 ? "+" : ""}${value}`;
}

export function AddictionCard({
	addiction,
	stats,
	onClick,
}: AddictionCardProps) {
	const candidates = useMemo(
		() => stats?.coverCandidates ?? [],
		[stats?.coverCandidates],
	);
	const [idx, setIdx] = useState(0);
	const firstCandidate = candidates[0] ?? null;

	useEffect(() => {
		setIdx(0);
		if (!firstCandidate) return;
	}, [firstCandidate]);

	const imagePath = candidates[idx] ?? null;
	const weekCount = stats?.weekCount ?? 0;
	const delta = weekCount - (stats?.prevWeekCount ?? 0);
	const cleanLabel = useMemo(() => {
		if (!stats?.lastIncidentAt) return null;
		const ms = Date.now() - stats.lastIncidentAt;
		return formatDurationCompact(ms);
	}, [stats?.lastIncidentAt]);

	const lastIncidentLabel = stats?.lastIncidentAt
		? formatRelativeTime(stats.lastIncidentAt)
		: null;

	return (
		<button
			type="button"
			className="group text-left w-full h-full rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-destructive/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col"
			onClick={onClick}
		>
			<div className="relative aspect-[4/3] bg-muted shrink-0 overflow-hidden">
				{imagePath ? (
					<img
						src={`local-file://${imagePath}`}
						alt=""
						className="w-full h-full object-cover"
						loading="lazy"
						draggable={false}
						onError={() => {
							setIdx((v) => (v + 1 < candidates.length ? v + 1 : v));
						}}
					/>
				) : (
					<>
						<div className="absolute inset-0 bg-gradient-to-br from-destructive/20 via-muted/40 to-background/40" />
						<div className="relative h-full w-full flex items-center justify-center">
							<Flame className="h-12 w-12 text-destructive/80" />
						</div>
					</>
				)}

				<div className="absolute top-3 right-3 flex flex-col items-end gap-2">
					<Badge className="bg-black/60 backdrop-blur-md border border-white/10 text-white font-medium">
						{weekCount} · 7d
						{delta !== 0 ? (
							<span className="ml-2 inline-flex items-center gap-1 text-[11px]">
								{delta < 0 ? (
									<TrendingDown className="h-3 w-3 opacity-80" />
								) : (
									<TrendingUp className="h-3 w-3 opacity-80" />
								)}
								{formatSignedInt(delta)}
							</span>
						) : null}
					</Badge>

					{cleanLabel ? (
						<Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
							Clean {cleanLabel}
						</Badge>
					) : (
						<Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
							No incidents
						</Badge>
					)}
				</div>
			</div>

			<div className="p-5 flex flex-col flex-1 gap-2">
				<h3 className="font-semibold text-lg text-foreground group-hover:text-destructive transition-colors line-clamp-1 min-h-[1.75rem]">
					{addiction.content}
				</h3>

				{addiction.description ? (
					<p className="text-sm text-muted-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
						{addiction.description}
					</p>
				) : (
					<p className="text-sm text-muted-foreground/50 italic min-h-[2.5rem] leading-snug">
						No details
					</p>
				)}

				<div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
					<Flame className="w-3.5 h-3.5" />
					<span>
						{lastIncidentLabel
							? `Last incident ${lastIncidentLabel}`
							: "No incidents yet"}
					</span>
				</div>
			</div>
		</button>
	);
}
