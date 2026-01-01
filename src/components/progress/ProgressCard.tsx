import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EventPreview } from "@/components/timeline/EventPreview";
import { Badge } from "@/components/ui/badge";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyBestImage } from "@/lib/copyImage";
import { cn, formatTime } from "@/lib/utils";
import type { Event } from "@/types";

function formatTimeLabel(event: Event): string {
	const endTimestamp = event.endTimestamp ?? event.timestamp;
	if (endTimestamp > event.timestamp) {
		return `${formatTime(event.timestamp)}–${formatTime(endTimestamp)}`;
	}
	return formatTime(event.timestamp);
}

function highResPathFromLowResPath(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (!path.endsWith(".webp")) return null;
	return path.replace(/\.webp$/, ".hq.png");
}

export function ProgressCard({
	event,
	showProject = false,
	isLast = false,
}: {
	event: Event;
	showProject?: boolean;
	isLast?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const timeLabel = useMemo(() => formatTimeLabel(event), [event]);
	const lowResPath = event.originalPath ?? event.thumbnailPath;
	const highResPath = useMemo(
		() =>
			event.projectProgress === 1
				? highResPathFromLowResPath(event.originalPath)
				: null,
		[event.originalPath, event.projectProgress],
	);
	const preferredPath = highResPath ?? lowResPath;
	const [imagePath, setImagePath] = useState(preferredPath);

	useEffect(() => {
		setImagePath(preferredPath);
	}, [preferredPath]);

	const handleCopyImage = useMemo(
		() => async () => {
			await copyBestImage([highResPath, lowResPath, event.thumbnailPath]);
		},
		[event.thumbnailPath, highResPath, lowResPath],
	);

	return (
		<>
			<div className="grid grid-cols-[96px,1fr] gap-4">
				<div className="relative">
					<div className="pr-4 pt-1 text-right font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
						{timeLabel}
					</div>
					<div className="absolute -right-0.5 top-2 h-2 w-2 rounded-full bg-primary" />
					{!isLast && (
						<div className="absolute right-[2px] top-5 -bottom-7 w-px bg-primary/40" />
					)}
				</div>

				<ContextMenu>
					<ContextMenuTrigger asChild>
						<button
							type="button"
							onClick={() => setOpen(true)}
							className={cn(
								"group relative overflow-hidden rounded-xl border border-border bg-card text-left",
								"hover:border-primary/40 transition-colors",
							)}
						>
							<div className="relative aspect-video bg-muted">
								{imagePath ? (
									<img
										src={`local-file://${imagePath}`}
										alt=""
										className="h-full w-full object-cover"
										loading="lazy"
										onError={() => {
											if (
												highResPath &&
												imagePath === highResPath &&
												lowResPath
											) {
												setImagePath(lowResPath);
											}
										}}
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
										No image
									</div>
								)}

								{(event.caption || showProject) && (
									<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
										<div className="flex items-end justify-between gap-3">
											<div className="min-w-0">
												{event.caption && (
													<div className="truncate text-sm font-medium text-white/90">
														{event.caption}
													</div>
												)}
												{showProject && event.project && (
													<div className="mt-1 truncate text-xs text-white/70">
														{event.project}
													</div>
												)}
											</div>

											<div className="shrink-0">
												<Badge className="bg-primary/90 text-primary-foreground border-0">
													Progress
												</Badge>
											</div>
										</div>
									</div>
								)}
							</div>
						</button>
					</ContextMenuTrigger>
					<ContextMenuContent>
						<ContextMenuItem onSelect={handleCopyImage}>
							<Copy className="mr-2 h-4 w-4" />
							Copy image
						</ContextMenuItem>
					</ContextMenuContent>
				</ContextMenu>
			</div>

			<EventPreview event={event} open={open} onOpenChange={setOpen} />
		</>
	);
}
