import {
	AppWindow,
	ChevronLeft,
	Flame,
	LayoutGrid,
	SendHorizontal,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DaylineSlot } from "@/lib/dayline";
import type { DayWrappedSnapshot, Friend, SharedEvent } from "@/types";
import { AvatarDisplay } from "./AvatarDisplay";
import {
	Dayline,
	DaylineTimeMarkers,
	type DaylineViewMode,
	DayWrappedLegend,
} from "./Dayline";

export function PersonView({
	friend,
	showBackHeader,
	onBack,
	showIdentityRow,
	dayWrapped,
	updatedLabel,
	slots,
	daylineMode,
	onCycleDaylineMode,
	selectedLabels,
	onLabelToggle,
	sharedEvents,
	onOpenEvent,
	replyText,
	onReplyTextChange,
	renderEventCard,
}: {
	friend: Friend;
	showBackHeader: boolean;
	onBack: () => void;
	showIdentityRow: boolean;
	dayWrapped: DayWrappedSnapshot | null;
	updatedLabel: string | null;
	slots: DaylineSlot[];
	daylineMode: DaylineViewMode;
	onCycleDaylineMode: () => void;
	selectedLabels: Set<string>;
	onLabelToggle: (label: string) => void;
	sharedEvents: SharedEvent[];
	onOpenEvent: (event: SharedEvent) => void;
	replyText: string;
	onReplyTextChange: (value: string) => void;
	renderEventCard: (event: SharedEvent, onClick: () => void) => JSX.Element;
}) {
	const activityHeaderRight = useMemo(() => updatedLabel, [updatedLabel]);

	return (
		<div className="flex flex-col h-full">
			{showBackHeader && (
				<div className="flex items-center pb-2 mb-2 border-b border-border/40">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 -ml-2 rounded-full hover:bg-muted/20"
						onClick={onBack}
					>
						<ChevronLeft className="h-4 w-4 text-muted-foreground" />
					</Button>
				</div>
			)}

			<div className="flex-1 overflow-y-auto -mr-2 custom-scrollbar">
				{showIdentityRow && (
					<div className="flex items-center gap-3 mb-4 mt-1">
						<AvatarDisplay
							userId={friend.userId}
							username={friend.username}
							size="lg"
							avatarSettings={friend.avatarSettings}
						/>
						<div className="flex flex-col min-w-0">
							<div className="text-sm font-medium text-foreground truncate">
								@{friend.username}
							</div>
							<div className="text-[10px] text-muted-foreground">
								{updatedLabel ?? "No Day Wrapped yet"}
							</div>
						</div>
					</div>
				)}

				<div className="mb-6">
					<div className="flex items-center justify-between mb-3 px-1">
						<div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
							DAY WRAPPED
						</div>
						{dayWrapped && (
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 rounded-full hover:bg-muted/20"
								onClick={onCycleDaylineMode}
							>
								{daylineMode === "categories" && (
									<LayoutGrid className="size-2 text-muted-foreground" />
								)}
								{daylineMode === "apps" && (
									<AppWindow className="size-2 text-muted-foreground" />
								)}
								{daylineMode === "addiction" && (
									<Flame className="size-2 text-muted-foreground" />
								)}
							</Button>
						)}
					</div>

					{dayWrapped ? (
						<>
							<Dayline
								slots={slots}
								mode={daylineMode}
								selectedLabels={selectedLabels}
							/>
							<DaylineTimeMarkers
								slots={slots}
								mode={daylineMode}
								selectedLabels={selectedLabels}
							/>
							<DayWrappedLegend
								slots={slots}
								mode={daylineMode}
								selectedLabels={selectedLabels}
								onLabelToggle={onLabelToggle}
							/>
						</>
					) : (
						<div className="text-xs text-muted-foreground text-center py-6">
							Waiting for an update…
						</div>
					)}
				</div>

				<div className="space-y-3 mb-6 mr-2">
					<div className="flex items-center justify-between px-1">
						<div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
							ACTIVITY
						</div>
						{activityHeaderRight && (
							<div className="text-[10px] text-muted-foreground">
								{activityHeaderRight}
							</div>
						)}
					</div>
					{sharedEvents.length === 0 ? (
						<div className="text-xs text-muted-foreground text-center py-4">
							No recent activity
						</div>
					) : (
						sharedEvents.map((item) =>
							renderEventCard(item, () => onOpenEvent(item)),
						)
					)}
				</div>
			</div>

			<div className="pt-3 border-t border-border/40">
				<div className="relative flex items-center">
					<Input
						value={replyText}
						onChange={(e) => onReplyTextChange(e.target.value)}
						placeholder={`Reply to @${friend.username}...`}
						className="pr-8 h-9 text-xs bg-muted/10 border-transparent focus-visible:bg-muted/20 focus-visible:ring-0 placeholder:text-muted-foreground/50"
					/>
					<Button
						size="icon"
						variant="ghost"
						className="absolute right-1 h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
						disabled={!replyText.trim()}
					>
						<SendHorizontal className="h-3 w-3" />
					</Button>
				</div>
			</div>
		</div>
	);
}
