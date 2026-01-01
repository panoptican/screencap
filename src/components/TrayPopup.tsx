import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Flame,
	LayoutGrid,
	Loader2,
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
import { Textarea } from "@/components/ui/textarea";
import { DOT_ALPHA_BY_LEVEL, rgba } from "@/lib/color";
import {
	CATEGORY_RGB,
	computeDaylineSlots,
	type DaylineSlot,
	SLOTS_PER_HOUR,
	slotLevel,
} from "@/lib/dayline";
import type { Event } from "@/types";

function highResPathFromLowResPath(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (!path.endsWith(".webp")) return null;
	return path.replace(/\.webp$/, ".hq.png");
}

type ComposerState =
	| { kind: "idle" }
	| { kind: "capturing" }
	| {
			kind: "ready" | "saving";
			eventId: string;
			caption: string;
			previewPath: string | null;
			fallbackPath: string | null;
			highResPath: string | null;
	  }
	| { kind: "error"; message: string };

type DaylineViewMode = "addiction" | "categories";

function slotBg(
	slot: DaylineSlot,
	level: 0 | 1 | 2 | 3 | 4,
	mode: DaylineViewMode,
) {
	if (slot.count <= 0) return null;
	const alpha = DOT_ALPHA_BY_LEVEL[level];
	if (mode === "categories") return rgba(CATEGORY_RGB[slot.category], alpha);
	if (slot.addiction) return `hsl(var(--destructive) / ${alpha})`;
	return rgba(CATEGORY_RGB.Work, alpha);
}

function slotTitle(slot: DaylineSlot, mode: DaylineViewMode): string {
	const time = format(new Date(slot.startMs), "HH:mm");
	if (slot.count <= 0) return `${time} · 0`;
	if (mode === "categories")
		return `${time} · ${slot.count} · ${slot.category}`;
	if (slot.addiction)
		return `${time} · ${slot.count} · Addiction: ${slot.addiction}`;
	return `${time} · ${slot.count} · Non-addiction`;
}

function Dayline({
	slots,
	mode,
}: {
	slots: DaylineSlot[];
	mode: DaylineViewMode;
}) {
	const slices = [0, 1, 2, 3, 4, 5] as const;
	const hours = Array.from({ length: 24 }, (_, h) => h);

	return (
		<div className="grid grid-rows-6 gap-1">
			{slices.map((s) => (
				<div key={s} className="inline-grid grid-cols-[repeat(24,12px)] gap-1">
					{hours.map((h) => {
						const idx = h * SLOTS_PER_HOUR + s;
						const slot = slots[idx];
						const level = slotLevel(slot.count);
						const bg = slotBg(slot, level, mode);
						const style = bg ? { backgroundColor: bg } : undefined;
						const title = slotTitle(slot, mode);

						return (
							<div
								key={idx}
								style={style}
								title={title}
								className="bg-muted/50 h-3 w-3 rounded"
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
}: {
	slots: DaylineSlot[];
	mode: DaylineViewMode;
}) {
	const present = useMemo(() => {
		const s = new Set<string>();
		for (const slot of slots) {
			if (slot.count <= 0) continue;
			if (mode === "categories") s.add(slot.category);
			else s.add(slot.addiction ? "Addiction" : "Non-addiction");
		}
		return s;
	}, [mode, slots]);

	const alpha = DOT_ALPHA_BY_LEVEL[4];
	const legend =
		mode === "categories"
			? ([
					{ label: "Study", color: rgba(CATEGORY_RGB.Study, alpha) },
					{ label: "Work", color: rgba(CATEGORY_RGB.Work, alpha) },
					{ label: "Leisure", color: rgba(CATEGORY_RGB.Leisure, alpha) },
					{ label: "Chores", color: rgba(CATEGORY_RGB.Chores, alpha) },
					{ label: "Social", color: rgba(CATEGORY_RGB.Social, alpha) },
					{ label: "Unknown", color: rgba(CATEGORY_RGB.Unknown, alpha) },
				] as const)
			: ([
					{ label: "Addiction", color: `hsl(var(--destructive) / ${alpha})` },
					{ label: "Non-addiction", color: rgba(CATEGORY_RGB.Work, alpha) },
				] as const);

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
				{legend
					.filter((it) => present.has(it.label))
					.map((it) => (
						<div key={it.label} className="flex items-center gap-2">
							<span
								className="h-2.5 w-2.5 rounded-[3px] bg-muted/20"
								style={{ backgroundColor: it.color }}
							/>
							<span>{it.label}</span>
						</div>
					))}
			</div>
		</div>
	);
}

export function TrayPopup() {
	const [events, setEvents] = useState<Event[]>([]);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const captionRef = useRef<HTMLTextAreaElement | null>(null);
	const [isQuitConfirmOpen, setIsQuitConfirmOpen] = useState(false);
	const [composer, setComposer] = useState<ComposerState>({ kind: "idle" });
	const [daylineMode, setDaylineMode] = useState<DaylineViewMode>("addiction");
	const [day, setDay] = useState(() => startOfDay(new Date()));
	const todayStartMs = useMemo(() => startOfDay(new Date()).getTime(), []);
	const dayStartMs = useMemo(() => startOfDay(day).getTime(), [day]);
	const dayEndMs = useMemo(() => endOfDay(day).getTime(), [day]);
	const canGoForward = dayStartMs < todayStartMs;

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
		fetchEvents();
		const interval = setInterval(fetchEvents, 30000);
		return () => clearInterval(interval);
	}, [dayEndMs, dayStartMs]);

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		if (!window.api?.popup?.setHeight) return;

		const update = () => {
			const h = Math.ceil(
				el.scrollHeight + (el.offsetHeight - el.clientHeight),
			);
			void window.api.popup.setHeight(h);
		};

		update();
		const ro = new ResizeObserver(() => update());
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	useEffect(() => {
		const prevHtmlOverflow = document.documentElement.style.overflow;
		const prevBodyOverflow = document.body.style.overflow;
		document.documentElement.style.overflow = "hidden";
		document.body.style.overflow = "hidden";
		return () => {
			document.documentElement.style.overflow = prevHtmlOverflow;
			document.body.style.overflow = prevBodyOverflow;
		};
	}, []);

	const slots = useMemo(
		() => computeDaylineSlots(events, dayStartMs),
		[events, dayStartMs],
	);
	const titleDate = format(day, "EEE, MMM d");

	useEffect(() => {
		if (composer.kind !== "ready") return;
		captionRef.current?.focus();
	}, [composer.kind]);

	useEffect(() => {
		if (composer.kind === "idle") return;
		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			setComposer({ kind: "idle" });
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [composer.kind]);

	const submitCaption = useCallback(async () => {
		if (!window.api) return;
		if (composer.kind !== "ready") return;
		const eventId = composer.eventId;
		const caption = composer.caption.trim();
		if (!caption) return;

		setComposer((prev) =>
			prev.kind === "ready" && prev.eventId === eventId
				? { ...prev, kind: "saving" }
				: prev,
		);

		try {
			await window.api.storage.setEventCaption(eventId, caption);
			window.close();
		} catch {
			setComposer((prev) =>
				prev.kind === "saving" && prev.eventId === eventId
					? { ...prev, kind: "ready" }
					: prev,
			);
		}
	}, [composer]);

	const triggerCaptureNow = useCallback(() => {
		if (!window.api) return;
		const promise = window.api.capture.trigger();
		window.close();
		void promise;
	}, []);

	const triggerProjectProgressCapture = useCallback(async () => {
		if (!window.api) return;
		setComposer({ kind: "capturing" });
		try {
			const result = await window.api.capture.trigger({
				intent: "project_progress",
			});
			if (!result.eventId) {
				setComposer({ kind: "error", message: "Capture failed" });
				return;
			}
			const event = await window.api.storage.getEvent(result.eventId);
			if (!event) {
				setComposer({ kind: "error", message: "Capture failed" });
				return;
			}
			const fallbackPath = event.originalPath ?? event.thumbnailPath ?? null;
			const highResPath = highResPathFromLowResPath(event.originalPath);
			const previewPath = highResPath ?? fallbackPath;
			setComposer({
				kind: "ready",
				eventId: result.eventId,
				caption: "",
				previewPath,
				fallbackPath,
				highResPath,
			});
		} catch {
			setComposer({ kind: "error", message: "Capture failed" });
		}
	}, []);

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
					aria-label={
						daylineMode === "addiction" ? "Show categories" : "Show addiction"
					}
					className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
					onClick={() =>
						setDaylineMode((m) =>
							m === "addiction" ? "categories" : "addiction",
						)
					}
				>
					{daylineMode === "addiction" ? (
						<LayoutGrid className="size-3" />
					) : (
						<Flame className="size-3" />
					)}
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

			{composer.kind === "idle" ? (
				<>
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
					<Dayline slots={slots} mode={daylineMode} />
					<div className="mt-3 flex justify-between text-[10px] font-mono tracking-[0.18em] text-muted-foreground">
						<span>00</span>
						<span>06</span>
						<span>12</span>
						<span>18</span>
						<span>24</span>
					</div>

					<DayWrappedLegend slots={slots} mode={daylineMode} />

					<div className="mt-4 grid grid-cols-2 gap-2">
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
									className="flex-1 rounded-r-none bg-accent/20 text-accent-foreground hover:bg-accent/30"
									onClick={triggerCaptureNow}
									disabled={!window.api}
								>
									Capture now
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
									onSelect={() => {
										void triggerProjectProgressCapture();
									}}
								>
									Capture project progress
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</>
			) : (
				<div className="pt-6 pr-20">
					<div className="mb-3">
						<div className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
							PROJECT PROGRESS
						</div>
						<div className="mt-1 text-sm font-medium text-foreground/90">
							Add a caption
						</div>
					</div>

					{composer.kind === "capturing" ? (
						<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-10">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
							<div className="mt-3 text-xs text-muted-foreground">
								Capturing…
							</div>
						</div>
					) : composer.kind === "error" ? (
						<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-10">
							<div className="text-sm text-foreground/90">
								{composer.message}
							</div>
							<div className="mt-2 text-xs text-muted-foreground">
								Press Esc to go back
							</div>
						</div>
					) : (
						<>
							<div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
								{composer.previewPath ? (
									<img
										src={`local-file://${composer.previewPath}`}
										alt=""
										className="w-full h-auto object-contain"
										onError={() => {
											setComposer((prev) => {
												if (prev.kind !== "ready" && prev.kind !== "saving")
													return prev;
												if (
													!prev.highResPath ||
													prev.previewPath !== prev.highResPath
												)
													return prev;
												if (!prev.fallbackPath) return prev;
												return { ...prev, previewPath: prev.fallbackPath };
											});
										}}
									/>
								) : (
									<div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
										No image
									</div>
								)}
							</div>

							<div className="mt-3 space-y-2">
								<Textarea
									ref={captionRef}
									value={composer.caption}
									onChange={(e) => {
										const value = e.target.value;
										setComposer((prev) =>
											prev.kind === "ready" || prev.kind === "saving"
												? { ...prev, caption: value }
												: prev,
										);
									}}
									placeholder="What changed?"
									className="min-h-[96px] resize-none"
									disabled={composer.kind === "saving"}
									onKeyDown={(e) => {
										const isSend =
											(e.metaKey || e.ctrlKey) && e.key === "Enter";
										if (!isSend) return;
										e.preventDefault();
										void submitCaption();
									}}
								/>
								<div className="flex items-center justify-between text-[11px] text-muted-foreground">
									<span>
										{composer.kind === "saving"
											? "Saving…"
											: "Cmd+Enter to send"}
									</span>
									<span>{composer.caption.trim().length}/5000</span>
								</div>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}
