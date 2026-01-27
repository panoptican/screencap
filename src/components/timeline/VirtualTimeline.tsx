import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import { useAppStore } from "@/stores/app";
import type { Event } from "@/types";
import { EventCard } from "./EventCard";
import { useVirtualTimelineItems } from "./useVirtualTimeline";

const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 320;

const TimelineHeader = memo(function TimelineHeader({
	date,
	events,
}: {
	date: string;
	events: Event[];
}) {
	const updateEvent = useAppStore((s) => s.updateEvent);
	const needsReviewFilter = useAppStore((s) => s.filters.needsAddictionReview);

	const needsReviewIds = useMemo(
		() =>
			events
				.filter((e) => e.addictionCandidate && !e.trackedAddiction)
				.map((e) => e.id),
		[events],
	);

	const handleConfirmAll = useCallback(async () => {
		if (needsReviewIds.length === 0) return;
		await window.api.storage.confirmAddiction(needsReviewIds);
		for (const id of needsReviewIds) {
			const event = events.find((e) => e.id === id);
			if (event) {
				updateEvent(id, {
					trackedAddiction: event.addictionCandidate,
					addictionCandidate: null,
				});
			}
		}
	}, [needsReviewIds, events, updateEvent]);

	return (
		<div className="flex items-center gap-3 py-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
			<h3 className="text-sm font-medium text-muted-foreground">{date}</h3>
			{needsReviewFilter && needsReviewIds.length > 0 && (
				<Button
					variant="ghost"
					size="sm"
					className="h-6 px-2 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
					onClick={handleConfirmAll}
				>
					<Check className="h-3 w-3 mr-1" />
					Confirm all ({needsReviewIds.length})
				</Button>
			)}
		</div>
	);
});

const TimelineRow = memo(function TimelineRow({
	events,
	columns,
}: {
	events: Event[];
	columns: number;
}) {
	return (
		<div
			className="grid gap-4"
			style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
		>
			{events.map((event) => (
				<EventCard key={event.id} event={event} />
			))}
		</div>
	);
});

interface PaginationControlsProps {
	hasNextPage: boolean;
	totalPages: number;
}

const PaginationControls = memo(function PaginationControls({
	hasNextPage,
	totalPages,
}: PaginationControlsProps) {
	const pagination = useAppStore((s) => s.pagination);
	const setPagination = useAppStore((s) => s.setPagination);

	return (
		<div className="flex items-center gap-1 text-xs text-muted-foreground">
			<span>Page {pagination.page + 1} of {totalPages}</span>
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6"
				disabled={pagination.page === 0}
				onClick={() =>
					setPagination({ page: Math.max(0, pagination.page - 1) })
				}
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6"
				disabled={!hasNextPage}
				onClick={() => setPagination({ page: pagination.page + 1 })}
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
});

interface VirtualTimelineProps {
	groups: Map<string, Event[]>;
	hasNextPage: boolean;
	totalPages: number;
}

export function VirtualTimeline({ groups, hasNextPage, totalPages }: VirtualTimelineProps) {
	const parentRef = useRef<HTMLDivElement>(null);
	const columns = useResponsiveColumns(parentRef);
	const items = useVirtualTimelineItems(groups, columns);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: (index) => {
			const item = items[index];
			return item?.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT;
		},
		overscan: 3,
	});

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div className="flex-1 flex flex-col overflow-hidden">
			<div className="flex items-center justify-end px-6 py-2 border-b border-border/40">
				<PaginationControls hasNextPage={hasNextPage} totalPages={totalPages} />
			</div>
			<div
				ref={parentRef}
				className="flex-1 overflow-auto"
				style={{ contain: "strict" }}
			>
				<div
					className="relative w-full"
					style={{ height: `${virtualizer.getTotalSize()}px` }}
				>
					{virtualItems.map((virtualItem) => {
						const item = items[virtualItem.index];
						if (!item) return null;

						return (
							<div
								key={virtualItem.key}
								data-index={virtualItem.index}
								ref={virtualizer.measureElement}
								className="absolute top-0 left-0 w-full px-6 pb-4"
								style={{
									transform: `translateY(${virtualItem.start}px)`,
								}}
							>
								{item.type === "header" ? (
									<TimelineHeader date={item.date} events={item.events} />
								) : (
									<TimelineRow events={item.events} columns={columns} />
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
