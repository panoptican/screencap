import {
	eachDayOfInterval,
	endOfWeek,
	format,
	isSameDay,
	startOfDay,
	startOfWeek,
	subDays,
} from "date-fns";
import { cn } from "@/lib/utils";

type LevelClasses = readonly [string, string, string, string, string];

const DEFAULT_LEVELS: LevelClasses = [
	"bg-muted/50",
	"bg-primary/40",
	"bg-primary/60",
	"bg-primary/80",
	"bg-primary",
];

export function ContributionCalendar({
	selectedDay,
	onSelectDay,
	dayCounts,
	maxCount,
	ringDays,
	weeks = 8,
	weekStartsOn = 1,
	levelClasses = DEFAULT_LEVELS,
	ringClassName = "ring-1 ring-foreground/20",
	selectedClassName = "ring-2 ring-primary ring-offset-2 ring-offset-background",
	futureClassName = "opacity-30 cursor-default",
}: {
	selectedDay: Date;
	onSelectDay: (day: Date) => void;
	dayCounts: Map<number, number>;
	maxCount: number;
	ringDays?: Set<number>;
	weeks?: number;
	weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	levelClasses?: LevelClasses;
	ringClassName?: string;
	selectedClassName?: string;
	futureClassName?: string;
}) {
	const today = startOfDay(new Date());
	const start = startOfWeek(subDays(today, weeks * 7 - 1), { weekStartsOn });
	const end = startOfDay(endOfWeek(today, { weekStartsOn }));
	const days = eachDayOfInterval({ start, end });

	const weeksGrid: Date[][] = [];
	for (let i = 0; i < days.length; i += 7) {
		weeksGrid.push(days.slice(i, i + 7));
	}

	const level = (count: number): 0 | 1 | 2 | 3 | 4 => {
		if (count <= 0) return 0;
		if (maxCount <= 0) return 4;
		const l = Math.ceil((count / maxCount) * 4);
		if (l <= 1) return 1;
		if (l === 2) return 2;
		if (l === 3) return 3;
		return 4;
	};

	const ring = ringDays ?? new Set<number>();

	return (
		<div className="flex gap-1.5">
			{weeksGrid.map((week) => (
				<div key={week[0].getTime()} className="flex flex-col gap-1.5">
					{week.map((d) => {
						const dayStart = startOfDay(d).getTime();
						const count = dayCounts.get(dayStart) ?? 0;
						const l = level(count);
						const isSelected = isSameDay(d, selectedDay);
						const hasRing = ring.has(dayStart);
						const isFuture = dayStart > today.getTime();
						const title = `${format(d, "EEE, MMM d")} · ${count}`;

						return (
							<button
								key={dayStart}
								type="button"
								title={title}
								disabled={isFuture}
								onClick={() => onSelectDay(d)}
								className={cn(
									"h-3.5 w-3.5 rounded transition-all",
									levelClasses[l],
									isFuture ? futureClassName : "cursor-pointer",
									hasRing ? ringClassName : "",
									isSelected ? selectedClassName : "",
								)}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}
