import { useMemo } from "react";

interface StatsChartProps {
	stats: { category: string; count: number }[];
}

const CATEGORY_COLORS: Record<string, string> = {
	Study: "#3B82F6",
	Work: "#22C55E",
	Leisure: "#A855F7",
	Chores: "#F97316",
	Social: "#EC4899",
	Unknown: "#6B7280",
};

export function StatsChart({ stats }: StatsChartProps) {
	const total = useMemo(
		() => stats.reduce((sum, s) => sum + s.count, 0),
		[stats],
	);

	if (stats.length === 0) {
		return (
			<div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
				No activity data for this period
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="h-4 rounded-full overflow-hidden bg-muted flex">
				{stats.map((stat) => (
					<div
						key={stat.category}
						className="h-full transition-all duration-500"
						style={{
							width: `${(stat.count / total) * 100}%`,
							backgroundColor:
								CATEGORY_COLORS[stat.category] || CATEGORY_COLORS.Unknown,
						}}
					/>
				))}
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
				{stats.map((stat) => (
					<div key={stat.category} className="flex items-center gap-2">
						<div
							className="w-3 h-3 rounded-full"
							style={{
								backgroundColor:
									CATEGORY_COLORS[stat.category] || CATEGORY_COLORS.Unknown,
							}}
						/>
						<div>
							<p className="text-sm font-medium">{stat.category}</p>
							<p className="text-xs text-muted-foreground">
								{stat.count} ({Math.round((stat.count / total) * 100)}%)
							</p>
						</div>
					</div>
				))}
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
				{stats.slice(0, 3).map((stat) => (
					<div
						key={stat.category}
						className="p-4 rounded-lg border border-border bg-card"
					>
						<div className="flex items-center gap-2 mb-2">
							<div
								className="w-2 h-2 rounded-full"
								style={{
									backgroundColor:
										CATEGORY_COLORS[stat.category] || CATEGORY_COLORS.Unknown,
								}}
							/>
							<span className="text-sm text-muted-foreground">
								{stat.category}
							</span>
						</div>
						<p className="text-2xl font-semibold">{stat.count}</p>
						<p className="text-xs text-muted-foreground">captures</p>
					</div>
				))}
			</div>
		</div>
	);
}
