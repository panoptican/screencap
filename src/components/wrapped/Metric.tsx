export function Metric({
	label,
	value,
	detail,
	delta,
	deltaTone = "neutral",
}: {
	label: string;
	value: string;
	detail?: string;
	delta?: string;
	deltaTone?: "up" | "down" | "neutral";
}) {
	const deltaClass =
		deltaTone === "up"
			? "text-green-400"
			: deltaTone === "down"
				? "text-red-400"
				: "text-muted-foreground";

	return (
		<div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background/30 px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0 font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
					{label.toUpperCase()}
				</div>
				{delta ? (
					<div
						className={`shrink-0 font-mono text-[10px] tracking-[0.18em] ${deltaClass}`}
					>
						{delta}
					</div>
				) : null}
			</div>
			<div
				className="mt-1 truncate text-2xl font-semibold leading-none"
				title={value}
			>
				{value}
			</div>
			{detail ? (
				<div
					className="mt-1 truncate text-xs text-muted-foreground"
					title={detail}
				>
					{detail}
				</div>
			) : null}
		</div>
	);
}
