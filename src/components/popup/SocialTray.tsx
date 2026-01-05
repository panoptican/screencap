import { AnimatePresence, motion } from "framer-motion";
import {
	Activity,
	AppWindow,
	ChevronLeft,
	Flame,
	MessageCircle,
	Plus,
	SendHorizontal,
	UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DaylineSlot, SLOTS_PER_DAY, toCategory } from "@/lib/dayline";
import { encodeEventComment, parseEventComment } from "@/lib/socialComments";
import type {
	ChatMessage,
	DayWrappedSnapshot,
	Friend,
	FriendRequest,
	RoomInvite,
	SharedEvent,
	SocialIdentity,
} from "@/types";
import {
	Dayline,
	DaylineTimeMarkers,
	type DaylineViewMode,
	DayWrappedLegend,
	VIEW_MODE_ORDER,
} from "./Dayline";

type View = "list" | "add" | "detail";

function initials(username: string): string {
	const trimmed = username.trim();
	if (!trimmed) return "??";
	return trimmed.slice(0, 2).toUpperCase();
}

function timeAgo(timestampMs: number): string {
	const diffMs = Date.now() - timestampMs;
	if (!Number.isFinite(diffMs) || diffMs < 0) return "Just now";
	const minutes = Math.floor(diffMs / 60000);
	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

function eventImageSrc(event: SharedEvent): string | null {
	const path = event.thumbnailPath ?? event.originalPath;
	return path ? `local-file://${path}` : null;
}

function toDaylineSlots(snapshot: DayWrappedSnapshot): DaylineSlot[] {
	return snapshot.slots.slice(0, SLOTS_PER_DAY).map((s) => ({
		startMs: s.startMs,
		count: s.count,
		category: toCategory(s.category),
		addiction: s.addiction,
		appName: s.appName,
	}));
}

export function SocialTray() {
	const [view, setView] = useState<View>("list");
	const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
	const [commentEvent, setCommentEvent] = useState<SharedEvent | null>(null);

	const [identity, setIdentity] = useState<SocialIdentity | null>(null);
	const [friends, setFriends] = useState<Friend[]>([]);
	const [pendingFriendRequests, setPendingFriendRequests] = useState<
		FriendRequest[]
	>([]);
	const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);
	const [feed, setFeed] = useState<SharedEvent[]>([]);

	const [selectedDayWrapped, setSelectedDayWrapped] =
		useState<DayWrappedSnapshot | null>(null);
	const [daylineMode, setDaylineMode] = useState<DaylineViewMode>("categories");
	const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());

	const [isBusy, setIsBusy] = useState(false);

	const [registerUsername, setRegisterUsername] = useState("");
	const [registerError, setRegisterError] = useState<string | null>(null);

	const [addFriendUsername, setAddFriendUsername] = useState("");
	const [addFriendError, setAddFriendError] = useState<string | null>(null);

	const [replyText, setReplyText] = useState("");
	const [commentText, setCommentText] = useState("");
	const [commentThreadId, setCommentThreadId] = useState<string | null>(null);
	const [commentMessages, setCommentMessages] = useState<ChatMessage[]>([]);
	const [commentError, setCommentError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!window.api?.social) return;

		try {
			const id = await window.api.social.getIdentity();
			setIdentity(id);

			if (!id) {
				setFriends([]);
				setPendingFriendRequests([]);
				setRoomInvites([]);
				setFeed([]);
				return;
			}

			const [f, friendReqs, invites, cachedFeed] = await Promise.all([
				window.api.social.listFriends(),
				window.api.social.listFriendRequests(),
				window.api.rooms.listInvites(),
				window.api.socialFeed.getFeed({ limit: 200 }),
			]);

			setFriends(f);
			setPendingFriendRequests(
				friendReqs.filter((r) => r.status === "pending"),
			);
			setRoomInvites(invites);
			setFeed(cachedFeed);

			void window.api.sharedProjects
				.syncAll()
				.then(() => window.api.socialFeed.getFeed({ limit: 200 }))
				.then((fresh) => setFeed(fresh))
				.catch(() => {});
		} catch (e) {
			console.error(e);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const cycleProfileMode = useCallback(() => {
		setDaylineMode((m) => {
			const idx = VIEW_MODE_ORDER.indexOf(m);
			return VIEW_MODE_ORDER[(idx + 1) % VIEW_MODE_ORDER.length];
		});
	}, []);

	const handleLabelToggle = useCallback((label: string) => {
		setSelectedLabels((prev) => {
			const next = new Set(prev);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	}, []);

	const openFriend = useCallback(async (friend: Friend) => {
		setSelectedFriend(friend);
		setSelectedDayWrapped(null);
		setSelectedLabels(new Set());
		setDaylineMode("categories");
		setView("detail");

		try {
			const snapshot = await window.api.socialFeed.getFriendDayWrapped(
				friend.userId,
			);
			setSelectedDayWrapped(snapshot);
		} catch {}
	}, []);

	const openComments = useCallback(
		async (event: SharedEvent) => {
			if (!identity) return;
			setCommentEvent(event);
			setCommentText("");
			setCommentMessages([]);
			setCommentThreadId(null);
			setCommentError(null);

			try {
				const threadId = await window.api.chat.openProjectThread(event.roomId);
				setCommentThreadId(threadId);
				const since = Math.max(0, event.timestampMs - 7 * 24 * 60 * 60 * 1000);
				const messages = await window.api.chat.fetchMessages(threadId, since);
				setCommentMessages(messages);
			} catch (e) {
				setCommentError(String(e));
			}
		},
		[identity],
	);

	const closeComments = useCallback(() => {
		setCommentEvent(null);
		setCommentText("");
		setCommentMessages([]);
		setCommentThreadId(null);
		setCommentError(null);
	}, []);

	const sendComment = useCallback(async () => {
		if (!commentEvent || !commentThreadId || !identity) return;
		const text = commentText.trim();
		if (!text) return;
		setIsBusy(true);
		try {
			await window.api.chat.sendMessage(
				commentThreadId,
				encodeEventComment(commentEvent.id, text),
			);
			setCommentText("");
			const since =
				commentMessages.length > 0
					? (commentMessages[commentMessages.length - 1]?.timestampMs ?? 0)
					: Math.max(0, commentEvent.timestampMs - 7 * 24 * 60 * 60 * 1000);
			const next = await window.api.chat.fetchMessages(commentThreadId, since);
			setCommentMessages((prev) => [...prev, ...next]);
		} catch (e) {
			setCommentError(String(e));
		} finally {
			setIsBusy(false);
		}
	}, [commentEvent, commentMessages, commentText, commentThreadId, identity]);

	const closeFriend = useCallback(() => {
		setSelectedFriend(null);
		setSelectedDayWrapped(null);
		setReplyText("");
		setSelectedLabels(new Set());
		setDaylineMode("categories");
		setView("list");
	}, []);

	const incomingFriendRequests = useMemo(() => {
		if (!identity) return [];
		return pendingFriendRequests.filter((r) => r.toUserId === identity.userId);
	}, [identity, pendingFriendRequests]);

	const latestActivityByUserId = useMemo(() => {
		const map = new Map<string, number>();
		for (const e of feed) {
			const prev = map.get(e.authorUserId) ?? 0;
			if (e.timestampMs > prev) map.set(e.authorUserId, e.timestampMs);
		}
		return map;
	}, [feed]);

	const handleRegister = useCallback(async () => {
		if (!window.api?.social) return;
		const username = registerUsername.trim();
		if (!username) return;

		setIsBusy(true);
		setRegisterError(null);
		try {
			await window.api.social.registerUsername(username);
			setRegisterUsername("");
			await refresh();
		} catch (e) {
			setRegisterError(String(e));
		} finally {
			setIsBusy(false);
		}
	}, [registerUsername, refresh]);

	const handleSendFriendRequest = useCallback(async () => {
		if (!window.api?.social) return;
		const username = addFriendUsername.trim();
		if (!username) return;

		setIsBusy(true);
		setAddFriendError(null);
		try {
			await window.api.social.sendFriendRequest(username);
			setAddFriendUsername("");
			setView("list");
			await refresh();
		} catch (e) {
			setAddFriendError(String(e));
		} finally {
			setIsBusy(false);
		}
	}, [addFriendUsername, refresh]);

	const handleAcceptFriendRequest = useCallback(
		async (requestId: string) => {
			if (!window.api?.social) return;
			setIsBusy(true);
			try {
				await window.api.social.acceptFriendRequest(requestId);
				await window.api.socialFeed.ensureFriendsFeedRoom();
				await refresh();
			} finally {
				setIsBusy(false);
			}
		},
		[refresh],
	);

	const handleRejectFriendRequest = useCallback(
		async (requestId: string) => {
			if (!window.api?.social) return;
			setIsBusy(true);
			try {
				await window.api.social.rejectFriendRequest(requestId);
				await refresh();
			} finally {
				setIsBusy(false);
			}
		},
		[refresh],
	);

	const handleAcceptRoomInvite = useCallback(
		async (invite: RoomInvite) => {
			setIsBusy(true);
			try {
				await window.api.rooms.acceptProjectInvite({
					roomId: invite.roomId,
					roomName: invite.roomName,
					ownerUserId: invite.fromUserId,
					ownerUsername: invite.fromUsername,
				});
				await refresh();
			} finally {
				setIsBusy(false);
			}
		},
		[refresh],
	);

	if (!identity) {
		return (
			<div className="flex h-[400px] flex-col items-center justify-center p-6 text-center space-y-4">
				<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
					<Activity className="h-6 w-6 text-primary" />
				</div>
				<div className="space-y-1">
					<h3 className="text-sm font-medium">Create your identity</h3>
					<p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
						Choose a unique username to connect with friends and share your day.
					</p>
				</div>
				<div className="w-full max-w-[240px] space-y-2">
					<Input
						value={registerUsername}
						onChange={(e) => setRegisterUsername(e.target.value)}
						placeholder="username"
						className="text-center text-sm"
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
					/>
					<Button
						className="w-full"
						size="sm"
						onClick={handleRegister}
						disabled={isBusy || !registerUsername.trim()}
					>
						{isBusy ? "Creating..." : "Get Started"}
					</Button>
					{registerError && (
						<div className="text-[10px] text-destructive mt-2">
							{registerError}
						</div>
					)}
				</div>
			</div>
		);
	}

	if (commentEvent) {
		const usersById = new Map<string, string>();
		usersById.set(identity.userId, identity.username);
		for (const f of friends) usersById.set(f.userId, f.username);

		const parsed = commentMessages
			.map((m) => {
				const parsed = parseEventComment(m.text);
				if (!parsed || parsed.eventId !== commentEvent.id) return null;
				return {
					id: m.id,
					authorUserId: m.authorUserId,
					authorUsername:
						usersById.get(m.authorUserId) ?? m.authorUserId.slice(0, 8),
					timestampMs: m.timestampMs,
					text: parsed.text,
				};
			})
			.filter((v): v is NonNullable<typeof v> => v !== null)
			.sort((a, b) => a.timestampMs - b.timestampMs);

		return (
			<div className="relative h-[400px] w-full overflow-hidden">
				<div className="absolute inset-0 flex flex-col">
					<div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 -ml-2 rounded-full hover:bg-muted/20"
							onClick={closeComments}
						>
							<ChevronLeft className="h-4 w-4 text-muted-foreground" />
						</Button>
						<div className="text-sm font-medium">Comments</div>
						<div className="w-6" />
					</div>

					<div className="flex-1 overflow-y-auto -mr-2 pr-2 custom-scrollbar space-y-2">
						{commentError && (
							<div className="text-[10px] text-destructive">{commentError}</div>
						)}
						{parsed.length === 0 ? (
							<div className="text-xs text-muted-foreground text-center py-6">
								No comments yet
							</div>
						) : (
							parsed.map((c) => (
								<div
									key={c.id}
									className="rounded-lg border border-border/40 bg-muted/5 px-3 py-2"
								>
									<div className="flex items-center justify-between">
										<div className="text-[10px] text-muted-foreground">
											@{c.authorUsername}
										</div>
										<div className="text-[10px] text-muted-foreground">
											{timeAgo(c.timestampMs)}
										</div>
									</div>
									<div className="text-xs text-foreground/90 mt-1">
										{c.text}
									</div>
								</div>
							))
						)}
					</div>

					<div className="pt-3 border-t border-border/40">
						<div className="relative flex items-center">
							<Input
								value={commentText}
								onChange={(e) => setCommentText(e.target.value)}
								placeholder="Write a comment…"
								className="pr-8 h-9 text-xs bg-muted/10 border-transparent focus-visible:bg-muted/20 focus-visible:ring-0 placeholder:text-muted-foreground/50"
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										void sendComment();
									}
								}}
							/>
							<Button
								size="icon"
								variant="ghost"
								className="absolute right-1 h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
								disabled={!commentText.trim() || isBusy || !commentThreadId}
								onClick={() => void sendComment()}
							>
								<SendHorizontal className="h-3 w-3" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-[400px] w-full overflow-hidden">
			<AnimatePresence initial={false} mode="popLayout">
				{view === "list" ? (
					<motion.div
						key="list"
						initial={{ x: -20, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: -20, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="absolute inset-0 flex flex-col"
					>
						<div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
							<div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">
								PULSE
							</div>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 rounded-full hover:bg-muted/20"
									onClick={() => setView("add")}
								>
									<Plus className="h-3 w-3 text-muted-foreground" />
								</Button>
							</div>
						</div>

						{incomingFriendRequests.length > 0 && (
							<div className="mb-3 space-y-2">
								<div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground">
									REQUESTS
								</div>
								{incomingFriendRequests.map((req) => (
									<div
										key={req.id}
										className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2"
									>
										<span className="text-xs text-foreground">
											@{req.fromUsername}
										</span>
										<div className="flex gap-1">
											<Button
												size="sm"
												variant="ghost"
												className="h-6 px-2 text-xs hover:bg-emerald-500/20 hover:text-emerald-500"
												onClick={() => handleAcceptFriendRequest(req.id)}
												disabled={isBusy}
											>
												Accept
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="h-6 px-2 text-xs hover:bg-destructive/20 hover:text-destructive"
												onClick={() => handleRejectFriendRequest(req.id)}
												disabled={isBusy}
											>
												Reject
											</Button>
										</div>
									</div>
								))}
							</div>
						)}

						{roomInvites.length > 0 && (
							<div className="mb-3 space-y-2">
								<div className="text-[9px] font-mono tracking-[0.2em] text-muted-foreground">
									INVITES
								</div>
								{roomInvites.map((inv) => (
									<div
										key={inv.id}
										className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2"
									>
										<div className="flex flex-col">
											<span className="text-xs text-foreground">
												{inv.roomName}
											</span>
											<span className="text-[10px] text-muted-foreground">
												from @{inv.fromUsername}
											</span>
										</div>
										<Button
											size="sm"
											variant="ghost"
											className="h-6 px-2 text-xs hover:bg-primary/10 hover:text-primary"
											onClick={() => handleAcceptRoomInvite(inv)}
											disabled={isBusy}
										>
											Join
										</Button>
									</div>
								))}
							</div>
						)}

						{friends.length > 0 && (
							<div className="mb-4">
								<div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
									{friends.map((friend) => (
										<FriendAvatarItem
											key={friend.userId}
											friend={friend}
											lastActiveMs={
												latestActivityByUserId.get(friend.userId) ?? null
											}
											onClick={() => void openFriend(friend)}
										/>
									))}
								</div>
							</div>
						)}

						<div className="flex-1 overflow-y-auto space-y-3 -mr-2 pr-2 custom-scrollbar">
							{feed.length === 0 ? (
								<div className="text-sm text-muted-foreground py-8 text-center flex flex-col items-center gap-2">
									<Activity className="h-8 w-8 opacity-20" />
									<span>No recent activity</span>
								</div>
							) : (
								feed.map((item) => (
									<SharedEventCard
										key={item.id}
										item={item}
										onClick={() => {
											const friend = friends.find(
												(f) => f.userId === item.authorUserId,
											);
											if (friend) void openFriend(friend);
										}}
										onComment={() => void openComments(item)}
									/>
								))
							)}
						</div>
					</motion.div>
				) : view === "add" ? (
					<motion.div
						key="add"
						initial={{ x: 20, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: 20, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="absolute inset-0 flex flex-col"
					>
						<div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 -ml-2 rounded-full hover:bg-muted/20"
								onClick={() => {
									setView("list");
									setAddFriendUsername("");
									setAddFriendError(null);
								}}
							>
								<ChevronLeft className="h-4 w-4 text-muted-foreground" />
							</Button>
							<div className="text-sm font-medium">Add Friend</div>
							<div className="w-6" />
						</div>

						<div className="flex-1 flex flex-col items-center justify-center p-6">
							<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
								<UserPlus className="h-6 w-6 text-primary" />
							</div>
							<p className="text-xs text-muted-foreground mb-4 text-center max-w-[200px]">
								Enter your friend's username to send them a request.
							</p>
							<div className="w-full max-w-[240px] space-y-3">
								<Input
									value={addFriendUsername}
									onChange={(e) => setAddFriendUsername(e.target.value)}
									placeholder="username"
									className="text-center text-sm"
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											void handleSendFriendRequest();
										}
									}}
								/>
								<Button
									className="w-full"
									size="sm"
									onClick={() => void handleSendFriendRequest()}
									disabled={isBusy || !addFriendUsername.trim()}
								>
									{isBusy ? "Sending..." : "Send Request"}
								</Button>
								{addFriendError && (
									<div className="text-[10px] text-destructive text-center">
										{addFriendError}
									</div>
								)}
							</div>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="detail"
						initial={{ x: 20, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: 20, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="absolute inset-0 flex flex-col"
					>
						<FriendProfile
							friend={selectedFriend}
							onBack={closeFriend}
							dayWrapped={selectedDayWrapped}
							daylineMode={daylineMode}
							onCycleDaylineMode={cycleProfileMode}
							selectedLabels={selectedLabels}
							onLabelToggle={handleLabelToggle}
							sharedEvents={feed.filter(
								(e) => e.authorUserId === selectedFriend?.userId,
							)}
							onOpenComments={openComments}
							replyText={replyText}
							onReplyTextChange={setReplyText}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function FriendAvatarItem({
	friend,
	lastActiveMs,
	onClick,
}: {
	friend: Friend;
	lastActiveMs: number | null;
	onClick: () => void;
}) {
	const kind = useMemo(() => {
		if (!lastActiveMs) return "free";
		const ageMs = Date.now() - lastActiveMs;
		if (ageMs < 15 * 60 * 1000) return "focus";
		if (ageMs < 2 * 60 * 60 * 1000) return "busy";
		return "free";
	}, [lastActiveMs]);

	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex flex-col items-center gap-1 min-w-[56px]"
		>
			<div className="relative">
				<div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xs font-medium text-foreground/80 transition-transform group-hover:scale-105">
					{initials(friend.username)}
				</div>
				<div
					className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
						kind === "focus"
							? "bg-purple-500"
							: kind === "busy"
								? "bg-red-500"
								: "bg-emerald-500"
					}`}
				/>
			</div>
			<span className="text-[10px] text-muted-foreground truncate max-w-[64px]">
				@{friend.username}
			</span>
		</button>
	);
}

function SharedEventCard({
	item,
	onClick,
	onComment,
}: {
	item: SharedEvent;
	onClick: () => void;
	onComment: () => void;
}) {
	const imageSrc = useMemo(() => eventImageSrc(item), [item]);

	return (
		<div
			className="group relative overflow-hidden rounded-lg bg-muted/5 border border-border/40 hover:bg-muted/10 transition-all cursor-pointer"
			onClick={onClick}
			onKeyDown={(e) => e.key === "Enter" && onClick()}
		>
			<div className="aspect-[2/1] w-full bg-muted/10 relative overflow-hidden">
				{imageSrc ? (
					<img
						src={imageSrc}
						alt=""
						className="absolute inset-0 h-full w-full object-cover"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="text-[10px] text-muted-foreground opacity-50 uppercase tracking-widest font-mono">
							Screenshot
						</div>
					</div>
				)}
			</div>

			<div className="p-3 space-y-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="h-7 w-7 rounded-full bg-muted/20 flex items-center justify-center text-[10px] font-medium text-foreground/70">
							{initials(item.authorUsername)}
						</div>
						<div className="flex flex-col">
							<span className="text-xs font-medium text-foreground/90 truncate">
								@{item.authorUsername}
							</span>
							<span className="text-[10px] text-muted-foreground">
								{timeAgo(item.timestampMs)}
							</span>
						</div>
					</div>
					{item.category && (
						<span className="text-[10px] font-mono text-muted-foreground">
							{item.category}
						</span>
					)}
				</div>

				{item.appName && (
					<div className="text-xs text-foreground/90 truncate">
						{item.appName}
					</div>
				)}

				{item.windowTitle && (
					<div className="text-xs text-muted-foreground truncate">
						{item.windowTitle}
					</div>
				)}

				<div className="flex items-center justify-end pt-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-7 w-7 rounded-full hover:bg-muted/20"
						onClick={(e) => {
							e.stopPropagation();
							onComment();
						}}
					>
						<MessageCircle className="h-3 w-3 text-muted-foreground" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function FriendProfile({
	friend,
	onBack,
	dayWrapped,
	daylineMode,
	onCycleDaylineMode,
	selectedLabels,
	onLabelToggle,
	sharedEvents,
	onOpenComments,
	replyText,
	onReplyTextChange,
}: {
	friend: Friend | null;
	onBack: () => void;
	dayWrapped: DayWrappedSnapshot | null;
	daylineMode: DaylineViewMode;
	onCycleDaylineMode: () => void;
	selectedLabels: Set<string>;
	onLabelToggle: (label: string) => void;
	sharedEvents: SharedEvent[];
	onOpenComments: (event: SharedEvent) => void;
	replyText: string;
	onReplyTextChange: (value: string) => void;
}) {
	const slots = useMemo(
		() => (dayWrapped ? toDaylineSlots(dayWrapped) : []),
		[dayWrapped],
	);

	if (!friend) return <div />;

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 -ml-2 rounded-full hover:bg-muted/20"
					onClick={onBack}
				>
					<ChevronLeft className="h-4 w-4 text-muted-foreground" />
				</Button>
				<div className="text-sm font-medium">@{friend.username}</div>
				<div className="w-6" />
			</div>

			<div className="flex-1 overflow-y-auto -mr-2 pr-2 custom-scrollbar">
				<div className="flex flex-col items-center mb-6 mt-2">
					<div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xl font-medium text-foreground/80 mb-3">
						{initials(friend.username)}
					</div>
					<div className="text-xs text-muted-foreground">
						{dayWrapped
							? `Updated ${timeAgo(dayWrapped.publishedAtMs)}`
							: "No Day Wrapped yet"}
					</div>
				</div>

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
									<Activity className="h-3 w-3 text-muted-foreground" />
								)}
								{daylineMode === "apps" && (
									<AppWindow className="h-3 w-3 text-muted-foreground" />
								)}
								{daylineMode === "addiction" && (
									<Flame className="h-3 w-3 text-muted-foreground" />
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

				<div className="space-y-3 mb-6">
					<div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground px-1">
						ACTIVITY
					</div>
					{sharedEvents.length === 0 ? (
						<div className="text-xs text-muted-foreground text-center py-4">
							No recent activity
						</div>
					) : (
						sharedEvents.map((item) => (
							<SharedEventCard
								key={item.id}
								item={item}
								onClick={() => {}}
								onComment={() => onOpenComments(item)}
							/>
						))
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
