import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import {
	AppWindow,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Flame,
	LayoutGrid,
	Power,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShortcutKbd } from "@/components/ui/shortcut-kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/useSettings";
import { appNameToRgb, DOT_ALPHA_BY_LEVEL, rgba } from "@/lib/color";
import {
	CATEGORY_RGB,
	computeDaylineSlots,
	type DaylineSlot,
	SLOTS_PER_HOUR,
	slotLevel,
} from "@/lib/dayline";
import type { Event } from "@/types";
import { FriendsTab } from "./FriendsTab";
import { MessagesTab } from "./MessagesTab";
import { useLockBodyScroll } from "./useLockBodyScroll";
import { usePopupAutoHeight } from "./usePopupAutoHeight";

type DaylineViewMode = "categories" | "addiction" | "apps";

const VIEW_MODE_ORDER: DaylineViewMode[] = ["categories", "addiction", "apps"];

function slotBg(
	slot: DaylineSlot,
	level: 0 | 1 | 2 | 3 | 4,
	mode: DaylineViewMode,
) {
	if (slot.count <= 0) return null;
	const alpha = DOT_ALPHA_BY_LEVEL[level];
	if (mode === "categories") return rgba(CATEGORY_RGB[slot.category], alpha);
	if (mode === "apps") {
		if (!slot.appName) return rgba(CATEGORY_RGB.Unknown, alpha);
		return rgba(appNameToRgb(slot.appName), alpha);
	}
	if (slot.addiction) return `hsl(var(--destructive) / ${alpha})`;
	return rgba(CATEGORY_RGB.Work, alpha);
}

function slotTitle(slot: DaylineSlot, mode: DaylineViewMode): string {
	const time = format(new Date(slot.startMs), "HH:mm");
	if (slot.count <= 0) return `${time} · 0`;
	if (mode === "categories")
		return `${time} · ${slot.count} · ${slot.category}`;
	if (mode === "apps")
		return `${time} · ${slot.count} · ${slot.appName ?? "Unknown"}`;
	if (slot.addiction)
		return `${time} · ${slot.count} · Addiction: ${slot.addiction}`;
	return `${time} · ${slot.count} · Non-addiction`;
}

function slotLabel(slot: DaylineSlot, mode: DaylineViewMode): string | null {
	if (slot.count <= 0) return null;
	if (mode === "categories") return slot.category;
	if (mode === "apps") return slot.appName ?? "Unknown";
	return slot.addiction ? "Addiction" : "Non-addiction";
}

function computeSmartTimeMarkers(
	slots: DaylineSlot[],
	mode: DaylineViewMode,
	selectedLabels: Set<string>,
): { hour: number; highlight: boolean }[] {
	const hasSelection = selectedLabels.size > 0;

	// Aggregate counts per hour
	const hourCounts = new Map<number, number>();
	let firstHour: number | null = null;
	let lastHour: number | null = null;

	for (let i = 0; i < slots.length; i++) {
		const slot = slots[i];
		if (slot.count <= 0) continue;

		const label = slotLabel(slot, mode);
		if (hasSelection && (!label || !selectedLabels.has(label))) continue;

		const hour = Math.floor(i / SLOTS_PER_HOUR);
		hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + slot.count);

		if (firstHour === null) firstHour = hour;
		lastHour = hour;
	}

	// No activity - show sparse default markers
	if (firstHour === null || lastHour === null) {
		return [
			{ hour: 6, highlight: false },
			{ hour: 12, highlight: false },
			{ hour: 18, highlight: false },
		];
	}

	// Find peak hour and start of dense activity cluster
	let peakHour = firstHour;
	let peakCount = 0;
	let clusterStartHour: number | null = null;
	let maxClusterDensity = 0;

	for (const [hour, count] of hourCounts) {
		if (count > peakCount) {
			peakCount = count;
			peakHour = hour;
		}
		// Detect start of dense clusters (look for sudden increase in activity)
		const prevCount = hourCounts.get(hour - 1) ?? 0;
		const density = count - prevCount;
		if (density > maxClusterDensity && hour !== firstHour) {
			maxClusterDensity = density;
			clusterStartHour = hour;
		}
	}

	const markers: { hour: number; highlight: boolean }[] = [];
	const usedHours = new Set<number>();
	const MIN_SPACING = 2;

	const canAdd = (hour: number) => {
		if (hour < 0 || hour >= 24) return false;
		for (const used of usedHours) {
			if (Math.abs(used - hour) < MIN_SPACING) return false;
		}
		return true;
	};

	const addMarker = (hour: number, highlight: boolean) => {
		if (!canAdd(hour)) return false;
		usedHours.add(hour);
		markers.push({ hour, highlight });
		return true;
	};

	// Priority order: first, last, peak, cluster start, then fill gaps
	addMarker(firstHour, true);
	addMarker(lastHour, true);

	if (peakHour !== firstHour && peakHour !== lastHour) {
		addMarker(peakHour, true);
	}

	if (
		clusterStartHour !== null &&
		clusterStartHour !== firstHour &&
		clusterStartHour !== lastHour
	) {
		addMarker(clusterStartHour, true);
	}

	// Fill remaining gaps with evenly spaced reference points
	const range = lastHour - firstHour;
	if (range > 6) {
		// Try to add intermediate markers
		const intervals = Math.min(4, Math.floor(range / 3));
		for (let i = 1; i < intervals; i++) {
			const hour = Math.round(firstHour + (range * i) / intervals);
			addMarker(hour, false);
		}
	}

	return markers.sort((a, b) => a.hour - b.hour);
}

function DaylineTimeMarkers({
	slots,
	mode,
	selectedLabels,
}: {
	slots: DaylineSlot[];
	mode: DaylineViewMode;
	selectedLabels: Set<string>;
}) {
	const markers = useMemo(
		() => computeSmartTimeMarkers(slots, mode, selectedLabels),
		[slots, mode, selectedLabels],
	);

	// Build array of 24 hours, only showing markers where needed
	const hours = Array.from({ length: 24 }, (_, h) => {
		const marker = markers.find((m) => m.hour === h);
		return marker
			? { show: true, highlight: marker.highlight }
			: { show: false };
	});

	return (
		<div className="mt-3 inline-grid grid-cols-[repeat(24,12px)] gap-1">
			{hours.map((h, i) => (
				<span
					key={i}
					className={`text-[10px] font-mono tracking-[0.08em] transition-all ${
						h.show
							? h.highlight
								? "text-foreground/70"
								: "text-muted-foreground/50"
							: "text-transparent"
					}`}
				>
					{i.toString().padStart(2, "0")}
				</span>
			))}
		</div>
	);
}

function Dayline({
	slots,
	mode,
	currentSlotIdx,
	selectedLabels,
}: {
	slots: DaylineSlot[];
	mode: DaylineViewMode;
	currentSlotIdx: number | null;
	selectedLabels: Set<string>;
}) {
	const slices = [0, 1, 2, 3, 4, 5] as const;
	const hours = Array.from({ length: 24 }, (_, h) => h);
	const hasSelection = selectedLabels.size > 0;

	return (
		<div className="grid grid-rows-6 gap-1">
			{slices.map((s) => (
				<div key={s} className="inline-grid grid-cols-[repeat(24,12px)] gap-1">
					{hours.map((h) => {
						const idx = h * SLOTS_PER_HOUR + s;
						const slot = slots[idx];
						const level = slotLevel(slot.count);
						const bg = slotBg(slot, level, mode);
						const title = slotTitle(slot, mode);
						const isCurrent = currentSlotIdx === idx;
						const label = slotLabel(slot, mode);
						const isDimmed =
							hasSelection && label && !selectedLabels.has(label);
						const style = bg
							? { backgroundColor: bg, opacity: isDimmed ? 0.15 : 1 }
							: undefined;

						return (
							<div
								key={idx}
								style={style}
								title={title}
								className={`h-3 w-3 rounded bg-muted/50 transition-opacity ${isCurrent ? "ring-1 ring-foreground/30" : ""}`}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}

function DayWrappedLegend({
	slots,
	mode,
	selectedLabels,
	onLabelToggle,
}: {
	slots: DaylineSlot[];
	mode: DaylineViewMode;
	selectedLabels: Set<string>;
	onLabelToggle: (label: string) => void;
}) {
	const alpha = DOT_ALPHA_BY_LEVEL[4];
	const hasSelection = selectedLabels.size > 0;

	const legend = useMemo(() => {
		if (mode === "categories") {
			const present = new Set<string>();
			for (const slot of slots) {
				if (slot.count > 0) present.add(slot.category);
			}
			const items = [
				{ label: "Study", color: rgba(CATEGORY_RGB.Study, alpha) },
				{ label: "Work", color: rgba(CATEGORY_RGB.Work, alpha) },
				{ label: "Leisure", color: rgba(CATEGORY_RGB.Leisure, alpha) },
				{ label: "Chores", color: rgba(CATEGORY_RGB.Chores, alpha) },
				{ label: "Social", color: rgba(CATEGORY_RGB.Social, alpha) },
				{ label: "Unknown", color: rgba(CATEGORY_RGB.Unknown, alpha) },
			];
			return items.filter((it) => present.has(it.label));
		}
		if (mode === "addiction") {
			const present = new Set<string>();
			for (const slot of slots) {
				if (slot.count > 0)
					present.add(slot.addiction ? "Addiction" : "Non-addiction");
			}
			const items = [
				{ label: "Addiction", color: `hsl(var(--destructive) / ${alpha})` },
				{ label: "Non-addiction", color: rgba(CATEGORY_RGB.Work, alpha) },
			];
			return items.filter((it) => present.has(it.label));
		}
		const appCounts = new Map<string, number>();
		for (const slot of slots) {
			if (slot.count <= 0) continue;
			const name = slot.appName ?? "Unknown";
			appCounts.set(name, (appCounts.get(name) ?? 0) + slot.count);
		}
		return Array.from(appCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([name]) => ({
				label: name,
				color:
					name === "Unknown"
						? rgba(CATEGORY_RGB.Unknown, alpha)
						: rgba(appNameToRgb(name), alpha),
			}));
	}, [mode, slots, alpha]);

	const intensity = [1, 2, 3, 4] as const;

	return (
		<div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span className="font-mono text-[10px] tracking-[0.18em]">
					INTENSITY
				</span>
				<div className="flex items-center gap-1">
					{intensity.map((l) => (
						<span
							key={l}
							className="h-2.5 w-2.5 rounded-[3px] bg-muted/20"
							style={{
								backgroundColor: rgba(CATEGORY_RGB.Work, DOT_ALPHA_BY_LEVEL[l]),
							}}
						/>
					))}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
				{legend.map((it) => {
					const isSelected = selectedLabels.has(it.label);
					const isDimmed = hasSelection && !isSelected;
					return (
						<button
							key={it.label}
							type="button"
							onClick={() => onLabelToggle(it.label)}
							className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 transition-all hover:bg-muted/30 ${isSelected ? "ring-1 ring-foreground/30 bg-muted/20" : ""} ${isDimmed ? "opacity-40" : ""}`}
						>
							<span
								className="h-2.5 w-2.5 rounded-[3px] bg-muted/20"
								style={{ backgroundColor: it.color }}
							/>
							<span className="max-w-32 truncate">{it.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function StreakPopup() {
	const [events, setEvents] = useState<Event[]>([]);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);
	const [daylineMode, setDaylineMode] = useState<DaylineViewMode>("categories");
	const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
	const [tab, setTab] = useState<"day" | "friends" | "messages">("day");
	const [day, setDay] = useState(() => startOfDay(new Date()));
	const { settings } = useSettings();

	const handleLabelToggle = useCallback((label: string) => {
		setSelectedLabels((prev) => {
			const next = new Set(prev);
			if (next.has(label)) {
				next.delete(label);
			} else {
				next.add(label);
			}
			return next;
		});
	}, []);

	useEffect(() => {
		setSelectedLabels(new Set());
	}, [daylineMode]);
	const todayStartMs = useMemo(() => startOfDay(new Date()).getTime(), []);
	const dayStartMs = useMemo(() => startOfDay(day).getTime(), [day]);
	const dayEndMs = useMemo(() => endOfDay(day).getTime(), [day]);
	const canGoForward = dayStartMs < todayStartMs;

	useLockBodyScroll(true);
	usePopupAutoHeight(rootRef);

	useEffect(() => {
		const fetchEvents = async () => {
			if (!window.api) return;
			const result = await window.api.storage.getEvents({
				startDate: dayStartMs,
				endDate: dayEndMs,
				dismissed: false,
			});
			setEvents(result);
		};
		void fetchEvents();
		const interval = setInterval(fetchEvents, 30000);
		return () => clearInterval(interval);
	}, [dayEndMs, dayStartMs]);

	const slots = useMemo(
		() =>
			computeDaylineSlots(events, dayStartMs, {
				showDominantWebsites: settings.showDominantWebsites,
			}),
		[events, dayStartMs, settings.showDominantWebsites],
	);
	const titleDate = format(day, "EEE, MMM d");

	const isToday = dayStartMs === todayStartMs;
	const currentSlotIdx = useMemo(() => {
		if (!isToday) return null;
		const now = new Date();
		const hour = now.getHours();
		const minute = now.getMinutes();
		return hour * SLOTS_PER_HOUR + Math.floor(minute / 10);
	}, [isToday]);

	const triggerCaptureNow = useCallback(() => {
		if (!window.api) return;
		void window.api.capture.trigger();
		window.close();
	}, []);

	const triggerProjectProgressCapture = useCallback(() => {
		if (!window.api?.popup?.startProjectProgressCapture) return;
		void window.api.popup.startProjectProgressCapture();
		window.close();
	}, []);

	const triggerEndOfDay = useCallback(() => {
		if (!window.api?.eod?.openFlow) return;
		void window.api.eod.openFlow();
		window.close();
	}, []);

	useEffect(() => {
		if (!window.api) return;
		return window.api.on("shortcut:capture-now", () => {
			triggerCaptureNow();
		});
	}, [triggerCaptureNow]);

	return (
		<div
			ref={rootRef}
			className="relative w-full bg-background/95 backdrop-blur-xl p-4 rounded-xl border border-border"
		>
			{isQuitConfirmOpen && (
				<div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm">
					<div className="w-full max-w-[320px] rounded-lg border border-border bg-background p-4 shadow-xl">
						<div className="text-sm font-medium text-foreground">
							Quit Screencap?
						</div>
						<div className="mt-1 text-xs text-muted-foreground">
							This will stop capturing until you reopen the app.
						</div>
						<div className="mt-4 grid grid-cols-2 gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setIsQuitConfirmOpen(false)}
							>
								Cancel
							</Button>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => {
									if (!window.api) return;
									void window.api.app.quit();
								}}
							>
								Quit
							</Button>
						</div>
					</div>
				</div>
			)}

			<div className="absolute right-2 top-2 flex items-center gap-1">
				<button
					type="button"
					aria-label="Quit app"
					className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
					onClick={() => {
						if (!window.api) return;
						setIsQuitConfirmOpen(true);
					}}
				>
					<Power className="size-3" />
				</button>

				<button
					type="button"
					aria-label={`View: ${daylineMode}`}
					style={tab === "day" ? undefined : { display: "none" }}
					className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
					onClick={() =>
						setDaylineMode((m) => {
							const idx = VIEW_MODE_ORDER.indexOf(m);
							return VIEW_MODE_ORDER[(idx + 1) % VIEW_MODE_ORDER.length];
						})
					}
				>
					{daylineMode === "categories" && <Flame className="size-3" />}
					{daylineMode === "addiction" && <AppWindow className="size-3" />}
					{daylineMode === "apps" && <LayoutGrid className="size-3" />}
				</button>

				<button
					type="button"
					aria-label="Close"
					className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
					onClick={() => window.close()}
				>
					<X className="size-3" />
				</button>
			</div>

			<Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
				<TabsList className="grid w-full grid-cols-3 pr-20">
					<TabsTrigger value="day">Day</TabsTrigger>
					<TabsTrigger value="friends">Friends</TabsTrigger>
					<TabsTrigger value="messages">Messages</TabsTrigger>
				</TabsList>

				<TabsContent value="day" className="mt-4">
					<div className="mb-3 pr-20">
						<div className="flex items-center gap-1.5">
							<div className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
								DAY WRAPPED
							</div>
							<button
								type="button"
								aria-label="Previous day"
								className="inline-flex size-4 items-center justify-center rounded-md border border-border bg-background/30 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
								onClick={() => setDay((d) => startOfDay(subDays(d, 1)))}
							>
								<ChevronLeft className="size-2" />
							</button>

							<button
								type="button"
								aria-label="Next day"
								disabled={!canGoForward}
								className={`inline-flex size-4 items-center justify-center rounded-md border border-border bg-background/30 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground ${canGoForward ? "" : "pointer-events-none opacity-0"}`}
								onClick={() => setDay((d) => startOfDay(addDays(d, 1)))}
							>
								<ChevronRight className="size-2" />
							</button>
						</div>
						<div className="flex mt-0.5 items-center gap-1.5">
							<div className="text-sm font-medium text-foreground/90 text-center">
								{titleDate}
							</div>
						</div>
					</div>

					<Dayline
						slots={slots}
						mode={daylineMode}
						currentSlotIdx={currentSlotIdx}
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
						onLabelToggle={handleLabelToggle}
					/>

					<div className="mt-4 space-y-2">
						<Button
							size="sm"
							className="w-full justify-between bg-primary/15 text-primary hover:bg-primary/20"
							onClick={triggerEndOfDay}
							disabled={!window.api}
						>
							<span>End of day</span>
							<ShortcutKbd
								accelerator={settings.shortcuts.endOfDay}
								className="h-4 px-1 text-[9px] rounded-sm"
							/>
						</Button>

						<div className="grid grid-cols-2 gap-2">
							<Button
								size="sm"
								variant="outline"
								className="w-full hover:bg-primary/10"
								onClick={() => {
									window.api?.window.show();
									window.close();
								}}
								disabled={!window.api}
							>
								Open app
							</Button>

							<DropdownMenu>
								<div className="flex w-full">
									<Button
										size="sm"
										className="flex-1 justify-center rounded-r-none bg-accent/20 text-accent-foreground hover:bg-accent/30"
										onClick={triggerCaptureNow}
										disabled={!window.api}
									>
										<span>Capture now</span>
									</Button>
									<DropdownMenuTrigger asChild>
										<Button
											size="sm"
											className="rounded-l-none px-2 bg-accent/20 text-accent-foreground hover:bg-accent/30 border-l border-border/40"
											disabled={!window.api}
											aria-label="Capture options"
										>
											<ChevronDown className="size-3" />
										</Button>
									</DropdownMenuTrigger>
								</div>
								<DropdownMenuContent
									align="end"
									side="top"
									avoidCollisions={false}
								>
									<DropdownMenuItem
										onSelect={triggerProjectProgressCapture}
										className="flex items-center justify-between gap-3"
									>
										<span>Capture project progress</span>
										<ShortcutKbd
											accelerator={settings.shortcuts.captureProjectProgress}
											className="h-4 px-1 text-[9px] rounded-sm"
										/>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="friends" className="mt-4">
					<FriendsTab />
				</TabsContent>

				<TabsContent value="messages" className="mt-4">
					<MessagesTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
