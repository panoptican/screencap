import { Loader2 } from "lucide-react";
import { memo, useMemo } from "react";
import { useEvents } from "@/hooks/useEvents";
import { groupEventsByDate } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import { BulkActions } from "./BulkActions";
import { TimelineFilters } from "./TimelineFilters";
import { VirtualTimeline } from "./VirtualTimeline";

const SelectedBulkActions = memo(function SelectedBulkActions() {
	const selectedCount = useAppStore((s) => s.selectedEventIds.size);
	if (selectedCount === 0) return null;
	return <BulkActions />;
});

export function Timeline() {
	const { events, hasNextPage, totalPages, isLoading } = useEvents();
	const groupedEvents = useMemo(() => {
		return groupEventsByDate(events);
	}, [events]);

	return (
		<div className="h-full flex flex-col">
			<TimelineFilters />

			<SelectedBulkActions />

			{isLoading && events.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : groupedEvents.size === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-muted-foreground">
						No events yet. Screenshots will appear here once captured.
					</p>
				</div>
			) : (
				<VirtualTimeline groups={groupedEvents} hasNextPage={hasNextPage} totalPages={totalPages} />
			)}
		</div>
	);
}
