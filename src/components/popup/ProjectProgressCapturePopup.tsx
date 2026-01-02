import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLockBodyScroll } from "./useLockBodyScroll";
import { usePopupAutoHeight } from "./usePopupAutoHeight";

function highResPathFromLowResPath(
	path: string | null | undefined,
): string | null {
	if (!path) return null;
	if (!path.endsWith(".webp")) return null;
	return path.replace(/\.webp$/, ".hq.png");
}

function uniqueSorted(values: string[]): string[] {
	const map = new Map<string, string>();
	for (const v of values) {
		const trimmed = v.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (!map.has(key)) map.set(key, trimmed);
	}
	return Array.from(map.values()).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: "base" }),
	);
}

function parseEventIdFromHash(hash: string): string | null {
	const [route, query] = hash.split("?");
	if (route !== "#popup-capture") return null;
	const params = new URLSearchParams(query ?? "");
	const id = params.get("eventId");
	const trimmed = id?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

const AUTO_PROJECT_VALUE = "__auto__";

type State =
	| { kind: "idle" }
	| { kind: "loading"; eventId: string }
	| {
			kind: "ready";
			eventId: string;
			caption: string;
			project: string | null;
			previewPath: string | null;
			fallbackPath: string | null;
			highResPath: string | null;
			isSubmitting: boolean;
	  }
	| { kind: "error"; message: string };

export function ProjectProgressCapturePopup() {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const captionRef = useRef<HTMLTextAreaElement | null>(null);
	const [projectOptions, setProjectOptions] = useState<string[]>([]);
	const [state, setState] = useState<State>({ kind: "idle" });

	useLockBodyScroll(true);
	usePopupAutoHeight(rootRef);

	useEffect(() => {
		if (!window.api) return;
		void window.api.storage
			.getMemories("project")
			.then((memories) => {
				setProjectOptions(uniqueSorted(memories.map((m) => m.content)));
			})
			.catch(() => {});
	}, []);

	const loadEvent = useCallback(async (eventId: string) => {
		if (!window.api) return;
		setState({ kind: "loading", eventId });
		try {
			const event = await window.api.storage.getEvent(eventId);
			if (!event) {
				setState({ kind: "error", message: "Capture not found" });
				return;
			}
			const fallbackPath = event.originalPath ?? event.thumbnailPath ?? null;
			const highResPath = highResPathFromLowResPath(event.originalPath);
			const previewPath = highResPath ?? fallbackPath;
			setState({
				kind: "ready",
				eventId,
				caption: "",
				project: event.project ?? null,
				previewPath,
				fallbackPath,
				highResPath,
				isSubmitting: false,
			});
		} catch {
			setState({ kind: "error", message: "Failed to load capture" });
		}
	}, []);

	useEffect(() => {
		const initial = parseEventIdFromHash(window.location.hash);
		if (initial) {
			void loadEvent(initial);
		}
	}, [loadEvent]);

	useEffect(() => {
		if (!window.api) return;
		return window.api.on("shortcut:capture-project-progress", (eventId) => {
			if (typeof eventId !== "string" || !eventId.trim()) return;
			void loadEvent(eventId.trim());
		});
	}, [loadEvent]);

	useEffect(() => {
		if (state.kind !== "ready") return;
		captionRef.current?.focus();
	}, [state.kind]);

	const cancel = useCallback(() => {
		if (!window.api) {
			window.close();
			return;
		}
		if (state.kind === "ready") {
			void window.api.storage.deleteEvent(state.eventId);
		}
		window.close();
	}, [state]);

	useEffect(() => {
		if (state.kind === "idle") return;
		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			cancel();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [cancel, state.kind]);

	const submit = useCallback(() => {
		if (!window.api) return;
		if (state.kind !== "ready") return;
		if (state.isSubmitting) return;
		setState((prev) =>
			prev.kind === "ready" ? { ...prev, isSubmitting: true } : prev,
		);
		void window.api.storage
			.submitProjectProgressCapture({
				id: state.eventId,
				caption: state.caption.trim(),
				project: state.project,
			})
			.finally(() => {
				window.close();
			});
	}, [state]);

	const content = useMemo(() => {
		if (state.kind === "idle") {
			return (
				<div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 p-10">
					<div className="text-xs text-muted-foreground">Waiting…</div>
				</div>
			);
		}

		if (state.kind === "loading") {
			return (
				<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-10">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
					<div className="mt-3 text-xs text-muted-foreground">Loading…</div>
				</div>
			);
		}

		if (state.kind === "error") {
			return (
				<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-10">
					<div className="text-sm text-foreground/90">{state.message}</div>
					<div className="mt-2 text-xs text-muted-foreground">
						Press Esc to close
					</div>
				</div>
			);
		}

		return (
			<>
				<div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
					{state.previewPath ? (
						<img
							src={`local-file://${state.previewPath}`}
							alt=""
							className="w-full h-auto object-contain"
							onError={() => {
								setState((prev) => {
									if (prev.kind !== "ready") return prev;
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

				<div className="mt-3 space-y-3">
					<div className="space-y-2">
						<div className="text-[10px] font-mono tracking-[0.22em] text-muted-foreground">
							RELATED PROJECT
						</div>
						<Select
							value={state.project ?? AUTO_PROJECT_VALUE}
							onValueChange={(value) => {
								setState((prev) =>
									prev.kind === "ready"
										? {
												...prev,
												project: value === AUTO_PROJECT_VALUE ? null : value,
											}
										: prev,
								);
							}}
							disabled={state.isSubmitting}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Auto" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={AUTO_PROJECT_VALUE}>Auto</SelectItem>
								{projectOptions.length > 0 ? (
									<>
										<SelectSeparator />
										{projectOptions.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</>
								) : null}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Textarea
							ref={captionRef}
							value={state.caption}
							onChange={(e) => {
								const value = e.target.value;
								setState((prev) =>
									prev.kind === "ready" ? { ...prev, caption: value } : prev,
								);
							}}
							placeholder="What changed?"
							className="min-h-[96px] resize-none"
							disabled={state.isSubmitting}
							onKeyDown={(e) => {
								const isSend = (e.metaKey || e.ctrlKey) && e.key === "Enter";
								if (!isSend) return;
								e.preventDefault();
								submit();
							}}
						/>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground">
							<span>
								{state.isSubmitting ? "Saving…" : "Cmd+Enter to send"}
							</span>
							<span>{state.caption.trim().length}/5000</span>
						</div>
					</div>
				</div>
			</>
		);
	}, [projectOptions, state, submit]);

	return (
		<div
			ref={rootRef}
			className="relative w-full bg-background/95 backdrop-blur-xl p-4 rounded-xl border border-border"
		>
			<div className="drag-region flex items-start justify-between gap-3 mb-3">
				<div className="min-w-0 pr-2">
					<div className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
						PROJECT PROGRESS
					</div>
					<div className="mt-1 text-sm font-medium text-foreground/90">
						Add a caption
					</div>
				</div>

				<div className="no-drag flex items-center gap-1">
					<button
						type="button"
						aria-label="Close"
						className="no-drag inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
						onClick={cancel}
					>
						<X className="size-3" />
					</button>
				</div>
			</div>

			{content}
		</div>
	);
}
