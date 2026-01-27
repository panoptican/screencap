import { useMemo } from "react";
import type { Event } from "@/types";

export type VirtualTimelineItem =
	| { type: "header"; date: string; key: string; events: Event[] }
	| { type: "row"; events: Event[]; key: string };

export function useVirtualTimelineItems(
	groups: Map<string, Event[]>,
	columnsPerRow: number,
): VirtualTimelineItem[] {
	return useMemo(() => {
		const items: VirtualTimelineItem[] = [];

		for (const [date, events] of groups.entries()) {
			items.push({ type: "header", date, key: `header-${date}`, events });

			for (let i = 0; i < events.length; i += columnsPerRow) {
				const rowEvents = events.slice(i, i + columnsPerRow);
				items.push({
					type: "row",
					events: rowEvents,
					key: `row-${date}-${i}`,
				});
			}
		}

		return items;
	}, [groups, columnsPerRow]);
}
