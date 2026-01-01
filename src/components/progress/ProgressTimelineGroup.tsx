import { useMemo } from "react";
import type { Event } from "@/types";
import { ProgressCard } from "./ProgressCard";

export function ProgressTimelineGroup({
	date,
	events,
	showProject = false,
}: {
	date: string;
	events: Event[];
	showProject?: boolean;
}) {
	const ordered = useMemo(
		() => [...events].sort((a, b) => b.timestamp - a.timestamp),
		[events],
	);

	return (
		<div className="animate-fade-in">
			<h3 className="text-sm font-medium text-muted-foreground mb-4">{date}</h3>
			<div className="space-y-6">
				{ordered.map((event, idx) => (
					<ProgressCard
						key={event.id}
						event={event}
						showProject={showProject}
						isLast={idx === ordered.length - 1}
					/>
				))}
			</div>
		</div>
	);
}
