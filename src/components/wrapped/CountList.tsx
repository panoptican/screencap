export type CountItem = {
	label: string;
	count: number;
};

export function CountList({
	title,
	items,
}: {
	title: string;
	items: CountItem[];
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-lg border border-border bg-background/30 px-4 py-3">
				<div className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
					{title.toUpperCase()}
				</div>
				<div className="mt-2 text-sm text-muted-foreground">—</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-background/30 px-4 py-3">
			<div className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
				{title.toUpperCase()}
			</div>
			<div className="mt-2 space-y-1">
				{items.map((it, idx) => (
					<div
						key={it.label}
						className="flex items-baseline justify-between gap-4"
					>
						<div className="min-w-0 flex items-baseline gap-2 text-sm text-foreground/90">
							<span className="shrink-0 font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
								{String(idx + 1).padStart(2, "0")}
							</span>
							<span className="min-w-0 flex-1 truncate" title={it.label}>
								{it.label}
							</span>
						</div>
						<div className="shrink-0 font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
							{it.count}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
