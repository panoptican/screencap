import {
	Check,
	ChevronLeft,
	ChevronRight,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	Globe,
	Maximize2,
	MonitorPlay,
	Music,
	Settings2,
	Tag,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyBestImage } from "@/lib/copyImage";
import { cn, formatDate, formatTime, getCategoryColor } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import type { AutomationRule, Event, EventScreenshot, Settings } from "@/types";
import { parseBackgroundFromEvent } from "@/types";

function formatContentKind(kind: string | null): string {
	if (!kind) return "";
	const map: Record<string, string> = {
		youtube_video: "YouTube Video",
		youtube_short: "YouTube Short",
		netflix_title: "Netflix",
		twitch_stream: "Twitch Stream",
		twitch_vod: "Twitch VOD",
		spotify_track: "Spotify Track",
		spotify_episode: "Spotify Episode",
		web_page: "Web Page",
	};
	return map[kind] || kind;
}

function highResPathFromLowResPath(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (!path.endsWith(".webp")) return null;
	return path.replace(/\.webp$/, ".hq.png");
}

interface EventPreviewProps {
	event: Event;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function getActiveScreenshotIndex(
	screenshots: EventScreenshot[],
	activeId: string | null,
): number {
	if (screenshots.length === 0) return -1;
	if (activeId) {
		const idx = screenshots.findIndex((s) => s.id === activeId);
		if (idx !== -1) return idx;
	}
	const primaryIdx = screenshots.findIndex((s) => s.isPrimary);
	return primaryIdx !== -1 ? primaryIdx : 0;
}

export function EventPreview({ event, open, onOpenChange }: EventPreviewProps) {
	const [isRelabeling, setIsRelabeling] = useState(false);
	const [newLabel, setNewLabel] = useState(
		event.userLabel || event.category || "",
	);
	const [nsfwRevealed, setNsfwRevealed] = useState(false);
	const [screenshots, setScreenshots] = useState<EventScreenshot[]>([]);
	const [activeScreenshotId, setActiveScreenshotId] = useState<string | null>(
		null,
	);
	const [automationRules, setAutomationRules] = useState<
		Settings["automationRules"] | null
	>(null);
	const removeEvent = useAppStore((s) => s.removeEvent);

	const tags = event.tags ? JSON.parse(event.tags) : [];
	const subcategories = event.subcategories
		? JSON.parse(event.subcategories)
		: [];
	const isNsfw = tags.some((tag: string) =>
		["nsfw", "porn"].includes(tag.toLowerCase()),
	);
	const background = useMemo(() => parseBackgroundFromEvent(event), [event]);
	const endTimestamp = event.endTimestamp ?? event.timestamp;
	const timeLabel =
		endTimestamp > event.timestamp
			? `${formatTime(event.timestamp)}–${formatTime(endTimestamp)}`
			: formatTime(event.timestamp);
	const activeIndex = getActiveScreenshotIndex(screenshots, activeScreenshotId);
	const activeScreenshot = activeIndex >= 0 ? screenshots[activeIndex] : null;
	const previewBasePath = activeScreenshot?.originalPath ?? event.originalPath;
	const previewHighResPath =
		event.projectProgress === 1
			? highResPathFromLowResPath(previewBasePath)
			: null;
	const [previewPath, setPreviewPath] = useState<string | null>(
		previewHighResPath ?? previewBasePath ?? null,
	);
	const previewIndexLabel =
		screenshots.length > 0 && activeIndex >= 0
			? `${activeIndex + 1} / ${screenshots.length}`
			: null;
	const progressConfidence =
		event.projectProgressConfidence != null
			? Math.round(event.projectProgressConfidence * 100)
			: null;

	useEffect(() => {
		setPreviewPath(previewHighResPath ?? previewBasePath ?? null);
	}, [previewBasePath, previewHighResPath]);

	const handleCopyPreview = async () => {
		await copyBestImage([
			previewHighResPath,
			previewBasePath,
			event.thumbnailPath,
		]);
	};

	const navigate = useCallback(
		(delta: number) => {
			if (screenshots.length < 2) return;
			const idx = getActiveScreenshotIndex(screenshots, activeScreenshotId);
			if (idx < 0) return;
			const next = (idx + delta + screenshots.length) % screenshots.length;
			setActiveScreenshotId(screenshots[next]?.id ?? null);
		},
		[activeScreenshotId, screenshots],
	);

	useEffect(() => {
		if (!open) return;

		let cancelled = false;

		const run = async () => {
			try {
				const items = await window.api.storage.getEventScreenshots(event.id);
				if (cancelled) return;
				setScreenshots(items);
				const primary = items.find((s) => s.isPrimary) ?? items[0] ?? null;
				setActiveScreenshotId(primary?.id ?? null);
			} catch {
				if (cancelled) return;
				setScreenshots([]);
				setActiveScreenshotId(null);
			}
		};

		void run();

		return () => {
			cancelled = true;
		};
	}, [event.id, open]);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		const load = async () => {
			const settings = await window.api.settings.get();
			if (!cancelled) setAutomationRules(settings.automationRules);
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [open]);

	useEffect(() => {
		if (!open || screenshots.length < 2) return;

		const handler = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null;
			const tag = el?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable)
				return;

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				navigate(-1);
			}
			if (e.key === "ArrowRight") {
				e.preventDefault();
				navigate(1);
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, screenshots, navigate]);

	const handleDismiss = async () => {
		await window.api.storage.dismissEvents([event.id]);
		removeEvent(event.id);
		onOpenChange(false);
	};

	const handleRelabel = async () => {
		if (newLabel.trim()) {
			await window.api.storage.relabelEvents([event.id], newLabel.trim());
			setIsRelabeling(false);
		}
	};

	const handleConfirmAddiction = async () => {
		await window.api.storage.confirmAddiction([event.id]);
		onOpenChange(false);
	};

	const handleRejectAddiction = async () => {
		await window.api.storage.rejectAddiction([event.id]);
		onOpenChange(false);
	};

	const handleDelete = async () => {
		await window.api.storage.deleteEvent(event.id);
		removeEvent(event.id);
		onOpenChange(false);
	};

	const updateAutomationRule = useCallback(
		async (
			ruleType: "apps" | "hosts",
			key: string,
			updates: Partial<AutomationRule>,
		) => {
			const settings = await window.api.settings.get();
			const existingRule = settings.automationRules[ruleType][key] ?? {};
			const newRule: AutomationRule = { ...existingRule, ...updates };
			const newRules = {
				...settings.automationRules,
				[ruleType]: {
					...settings.automationRules[ruleType],
					[key]: newRule,
				},
			};
			const newSettings: Settings = {
				...settings,
				automationRules: newRules,
			};
			await window.api.settings.set(newSettings);
			setAutomationRules(newRules);
		},
		[],
	);

	const appRule = event.appBundleId
		? automationRules?.apps[event.appBundleId]
		: undefined;
	const hostRule = event.urlHost
		? automationRules?.hosts[event.urlHost]
		: undefined;

	const handleToggleLlmForApp = useCallback(async () => {
		if (!event.appBundleId) return;
		const current = appRule?.llm === "skip";
		await updateAutomationRule("apps", event.appBundleId, {
			llm: current ? "allow" : "skip",
		});
	}, [event.appBundleId, appRule?.llm, updateAutomationRule]);

	const handleToggleCaptureForApp = useCallback(async () => {
		if (!event.appBundleId) return;
		const current = appRule?.capture === "skip";
		await updateAutomationRule("apps", event.appBundleId, {
			capture: current ? "allow" : "skip",
		});
	}, [event.appBundleId, appRule?.capture, updateAutomationRule]);

	const handleToggleLlmForHost = useCallback(async () => {
		if (!event.urlHost) return;
		const current = hostRule?.llm === "skip";
		await updateAutomationRule("hosts", event.urlHost, {
			llm: current ? "allow" : "skip",
		});
	}, [event.urlHost, hostRule?.llm, updateAutomationRule]);

	const handleToggleCaptureForHost = useCallback(async () => {
		if (!event.urlHost) return;
		const current = hostRule?.capture === "skip";
		await updateAutomationRule("hosts", event.urlHost, {
			capture: current ? "allow" : "skip",
		});
	}, [event.urlHost, hostRule?.capture, updateAutomationRule]);

	const hasAutomationOptions = Boolean(event.appBundleId || event.urlHost);

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) setNsfwRevealed(false);
				onOpenChange(isOpen);
			}}
		>
			<DialogContent className="max-w-3xl h-[min(92vh,980px)] p-0 overflow-hidden">
				<DialogHeader className="px-6 py-4 border-b border-border">
					<DialogTitle className="flex items-center gap-2">
						Screenshot Details
						{event.category && (
							<Badge className={cn("ml-2", getCategoryColor(event.category))}>
								{event.userLabel || event.category}
							</Badge>
						)}
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="flex-1">
					<div className="px-6 py-5 space-y-5">
						<div className="rounded-lg overflow-hidden border border-border relative bg-muted">
							<ContextMenu>
								<ContextMenuTrigger asChild>
									<div className="relative w-full h-[56vh] bg-muted flex items-center justify-center">
										{previewPath ? (
											<img
												src={`local-file://${previewPath}`}
												alt=""
												className={cn(
													"max-h-full max-w-full object-contain transition-all duration-300",
													isNsfw && !nsfwRevealed && "blur-xl",
												)}
												onError={() => {
													if (
														previewHighResPath &&
														previewPath === previewHighResPath &&
														previewBasePath
													) {
														setPreviewPath(previewBasePath);
													}
												}}
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center text-muted-foreground">
												No image available
											</div>
										)}
									</div>
								</ContextMenuTrigger>
								<ContextMenuContent>
									<ContextMenuItem onSelect={handleCopyPreview}>
										<Copy className="mr-2 h-4 w-4" />
										Copy image
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
							{screenshots.length > 1 && (
								<>
									<Button
										type="button"
										variant="secondary"
										size="icon"
										className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur hover:bg-background/80"
										onClick={() => navigate(-1)}
									>
										<ChevronLeft className="h-4 w-4" />
									</Button>
									<Button
										type="button"
										variant="secondary"
										size="icon"
										className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur hover:bg-background/80"
										onClick={() => navigate(1)}
									>
										<ChevronRight className="h-4 w-4" />
									</Button>
									{previewIndexLabel && (
										<div className="absolute bottom-2 left-2">
											<Badge
												variant="secondary"
												className="bg-background/70 backdrop-blur"
											>
												{previewIndexLabel}
											</Badge>
										</div>
									)}
								</>
							)}
							{isNsfw && (
								<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
									<Button
										variant="secondary"
										size="sm"
										className={cn(
											"gap-2 pointer-events-auto",
											nsfwRevealed &&
												"opacity-0 hover:opacity-100 transition-opacity",
										)}
										onClick={() => setNsfwRevealed(!nsfwRevealed)}
									>
										{nsfwRevealed ? (
											<>
												<EyeOff className="h-4 w-4" />
												Hide
											</>
										) : (
											<>
												<Eye className="h-4 w-4" />
												Reveal NSFW Content
											</>
										)}
									</Button>
								</div>
							)}
						</div>

						{screenshots.length > 1 && (
							<div className="flex gap-2 overflow-x-auto pb-1">
								{screenshots.map((s) => {
									const hq =
										event.projectProgress === 1
											? highResPathFromLowResPath(s.originalPath)
											: null;
									const handleCopy = async () => {
										await copyBestImage([hq, s.originalPath, s.thumbnailPath]);
									};

									return (
										<ContextMenu key={s.id}>
											<ContextMenuTrigger asChild>
												<button
													type="button"
													onClick={() => setActiveScreenshotId(s.id)}
													className={cn(
														"relative shrink-0 rounded-md border border-border overflow-hidden transition",
														s.id === activeScreenshot?.id
															? "ring-2 ring-primary border-primary"
															: "hover:border-primary/50",
													)}
												>
													<img
														src={`local-file://${s.thumbnailPath}`}
														alt=""
														className={cn(
															"h-20 w-auto object-cover",
															isNsfw && !nsfwRevealed && "blur-md",
														)}
														loading="lazy"
													/>
													{s.isPrimary && (
														<div className="absolute top-1 left-1">
															<Badge
																variant="secondary"
																className="text-[10px] px-1 py-0"
															>
																Primary
															</Badge>
														</div>
													)}
												</button>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuItem onSelect={handleCopy}>
													<Copy className="mr-2 h-4 w-4" />
													Copy image
												</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>
									);
								})}
							</div>
						)}

						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">Date:</span>
								<p className="font-medium">{formatDate(event.timestamp)}</p>
							</div>
							<div>
								<span className="text-muted-foreground">Time:</span>
								<p className="font-medium">{timeLabel}</p>
							</div>
							{event.project && (
								<div>
									<span className="text-muted-foreground">Project:</span>
									<p className="font-medium">{event.project}</p>
								</div>
							)}
							{event.confidence !== null && (
								<div>
									<span className="text-muted-foreground">Confidence:</span>
									<p className="font-medium">
										{Math.round(event.confidence * 100)}%
									</p>
								</div>
							)}
							{event.appName && (
								<div>
									<span className="text-muted-foreground">App:</span>
									<p className="font-medium">{event.appName}</p>
								</div>
							)}
							{event.isFullscreen === 1 && (
								<div className="flex items-center gap-1">
									<Maximize2 className="h-3 w-3 text-muted-foreground" />
									<span className="font-medium">Fullscreen</span>
								</div>
							)}
						</div>

						{event.windowTitle && (
							<div>
								<span className="text-sm text-muted-foreground">Window:</span>
								<p className="mt-1 font-medium">{event.windowTitle}</p>
							</div>
						)}

						{(event.contentKind || event.urlHost) && (
							<div className="p-3 rounded-lg bg-muted/50 space-y-2">
								<div className="flex items-center gap-2 text-sm">
									{event.faviconPath && event.urlHost ? (
										<img
											src={`local-file://${event.faviconPath}`}
											alt=""
											className="h-4 w-4 rounded-sm object-contain"
											loading="lazy"
										/>
									) : event.contentKind?.includes("youtube") ||
										event.contentKind?.includes("netflix") ||
										event.contentKind?.includes("twitch") ? (
										<MonitorPlay className="h-4 w-4 text-primary" />
									) : (
										<Globe className="h-4 w-4 text-primary" />
									)}
									<span className="font-medium">
										{formatContentKind(event.contentKind) || "Web Activity"}
									</span>
								</div>
								{event.contentTitle && (
									<p className="text-sm">{event.contentTitle}</p>
								)}
								{event.contentId && event.contentKind !== "web_page" && (
									<p className="text-xs text-muted-foreground">
										ID: {event.contentId}
									</p>
								)}
								{event.urlHost && (
									<p className="text-xs text-muted-foreground">
										{event.urlHost}
									</p>
								)}
							</div>
						)}

						{background.length > 0 && (
							<div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Music className="h-4 w-4" />
									<span className="font-medium">Background Activity</span>
								</div>
								{background.map((bg) => (
									<div
										key={`${bg.provider}:${bg.id}`}
										className="flex items-center gap-3"
									>
										{bg.imageUrl ? (
											<img
												src={bg.imageUrl}
												alt=""
												className="h-10 w-10 rounded object-cover flex-shrink-0"
												loading="lazy"
											/>
										) : (
											<div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
												<Music className="h-5 w-5 text-muted-foreground" />
											</div>
										)}
										<div className="min-w-0 flex-1">
											<p className="text-sm font-medium truncate">{bg.title}</p>
											{bg.subtitle && (
												<p className="text-xs text-muted-foreground truncate">
													{bg.subtitle}
												</p>
											)}
											<p className="text-xs text-muted-foreground/60">
												{formatContentKind(bg.kind)}
											</p>
										</div>
										{bg.actionUrl && (
											<Button
												variant="outline"
												size="sm"
												className="flex-shrink-0"
												onClick={() =>
													void window.api.app.openExternal(bg.actionUrl!)
												}
											>
												<ExternalLink className="h-3 w-3 mr-1" />
												Open
											</Button>
										)}
									</div>
								))}
							</div>
						)}

						{event.caption && (
							<div>
								<span className="text-sm text-muted-foreground">
									Description:
								</span>
								<p className="mt-1">{event.caption}</p>
							</div>
						)}

						{event.projectProgress === 1 && (
							<div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm text-primary font-medium">
										Project progress
									</span>
									<span className="text-xs text-muted-foreground">
										{progressConfidence != null
											? `${progressConfidence}%`
											: "—"}
									</span>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									{event.project && (
										<Badge variant="outline" className="max-w-[240px] truncate">
											{event.project}
										</Badge>
									)}
								</div>
							</div>
						)}

						{subcategories.length > 0 && (
							<div>
								<span className="text-sm text-muted-foreground">
									Subcategories:
								</span>
								<div className="flex gap-2 mt-1 flex-wrap">
									{subcategories.map((sub: string) => (
										<Badge key={sub} variant="secondary">
											{sub}
										</Badge>
									))}
								</div>
							</div>
						)}

						{tags.length > 0 && (
							<div>
								<span className="text-sm text-muted-foreground">Tags:</span>
								<div className="flex gap-2 mt-1 flex-wrap">
									{tags.map((tag: string) => (
										<span key={tag} className="text-sm text-primary">
											#{tag}
										</span>
									))}
								</div>
							</div>
						)}

						{event.trackedAddiction && (
							<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm text-destructive font-medium">
										Addiction detected: {event.trackedAddiction}
									</span>
									<Button
										size="sm"
										variant="outline"
										className="border-destructive/30 text-destructive hover:bg-destructive/10"
										onClick={handleRejectAddiction}
									>
										Reject
									</Button>
								</div>
							</div>
						)}

						{!event.trackedAddiction && event.addictionCandidate && (
							<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
								<div className="flex items-center justify-between gap-3">
									<span className="text-sm text-amber-500 font-medium">
										Potential addiction: {event.addictionCandidate}
										{event.addictionConfidence != null && (
											<span className="ml-2 text-xs text-amber-500/80">
												{Math.round(event.addictionConfidence * 100)}%
											</span>
										)}
									</span>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
											onClick={handleRejectAddiction}
										>
											Reject
										</Button>
										<Button
											size="sm"
											className="bg-amber-500 hover:bg-amber-600 text-white"
											onClick={handleConfirmAddiction}
										>
											Accept
										</Button>
									</div>
								</div>
								{event.addictionPrompt && (
									<p className="text-sm text-muted-foreground">
										{event.addictionPrompt}
									</p>
								)}
							</div>
						)}

						<div className="flex items-center gap-2 pt-4 border-t border-border">
							{isRelabeling ? (
								<div className="flex gap-2 flex-1">
									<Input
										value={newLabel}
										onChange={(e) => setNewLabel(e.target.value)}
										placeholder="New label..."
										className="flex-1"
										autoFocus
										onKeyDown={(e) => e.key === "Enter" && handleRelabel()}
									/>
									<Button size="sm" onClick={handleRelabel}>
										<Check className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setIsRelabeling(false)}
									>
										Cancel
									</Button>
								</div>
							) : (
								<>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setIsRelabeling(true)}
									>
										<Tag className="h-4 w-4 mr-2" />
										Relabel
									</Button>
									<Button variant="outline" size="sm" onClick={handleDismiss}>
										<Trash2 className="h-4 w-4 mr-2" />
										Dismiss
									</Button>
									{hasAutomationOptions && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="outline" size="sm">
													<Settings2 className="h-4 w-4 mr-2" />
													Automation
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="start">
												{event.appBundleId && (
													<>
														<DropdownMenuLabel>
															{event.appName || event.appBundleId}
														</DropdownMenuLabel>
														<DropdownMenuCheckboxItem
															checked={appRule?.llm === "skip"}
															onCheckedChange={handleToggleLlmForApp}
														>
															Skip LLM
														</DropdownMenuCheckboxItem>
														<DropdownMenuCheckboxItem
															checked={appRule?.capture === "skip"}
															onCheckedChange={handleToggleCaptureForApp}
														>
															Skip capture
														</DropdownMenuCheckboxItem>
													</>
												)}
												{event.appBundleId && event.urlHost && (
													<DropdownMenuSeparator />
												)}
												{event.urlHost && (
													<>
														<DropdownMenuLabel>
															{event.urlHost}
														</DropdownMenuLabel>
														<DropdownMenuCheckboxItem
															checked={hostRule?.llm === "skip"}
															onCheckedChange={handleToggleLlmForHost}
														>
															Skip LLM
														</DropdownMenuCheckboxItem>
														<DropdownMenuCheckboxItem
															checked={hostRule?.capture === "skip"}
															onCheckedChange={handleToggleCaptureForHost}
														>
															Skip capture
														</DropdownMenuCheckboxItem>
													</>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
									<div className="flex-1" />
									<Button
										variant="destructive"
										size="sm"
										onClick={handleDelete}
									>
										Delete Permanently
									</Button>
								</>
							)}
						</div>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
