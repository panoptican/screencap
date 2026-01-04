import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMessage, ChatThread, Friend, Room } from "@/types";

export function MessagesTab() {
	const [threads, setThreads] = useState<ChatThread[]>([]);
	const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState("");
	const [friends, setFriends] = useState<Friend[]>([]);
	const [selectedFriendId, setSelectedFriendId] = useState<string>("");
	const [rooms, setRooms] = useState<Room[]>([]);
	const [selectedRoomId, setSelectedRoomId] = useState<string>("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refreshThreads = useCallback(async () => {
		if (!window.api?.chat) return;
		const list = await window.api.chat.listThreads();
		setThreads(list);
		if (!selectedThreadId && list.length > 0) {
			setSelectedThreadId(list[0].id);
		}
	}, [selectedThreadId]);

	const refreshFriends = useCallback(async () => {
		if (!window.api?.social) return;
		const list = await window.api.social.listFriends();
		setFriends(list);
		if (!selectedFriendId && list.length > 0) {
			setSelectedFriendId(list[0].userId);
		}
	}, [selectedFriendId]);

	const refreshRooms = useCallback(async () => {
		if (!window.api?.rooms) return;
		const list = await window.api.rooms.listRooms();
		setRooms(list);
		if (!selectedRoomId && list.length > 0) {
			setSelectedRoomId(list[0].id);
		}
	}, [selectedRoomId]);

	const refreshMessages = useCallback(async (threadId: string) => {
		if (!window.api?.chat) return;
		const list = await window.api.chat.fetchMessages(threadId);
		setMessages(list);
	}, []);

	useEffect(() => {
		const run = async () => {
			setError(null);
			try {
				await Promise.all([refreshThreads(), refreshFriends(), refreshRooms()]);
			} catch (e) {
				setError(String(e));
			}
		};
		void run();
	}, [refreshFriends, refreshRooms, refreshThreads]);

	useEffect(() => {
		if (!selectedThreadId) return;
		void refreshMessages(selectedThreadId);
	}, [refreshMessages, selectedThreadId]);

	useEffect(() => {
		if (!selectedThreadId) return;
		const interval = setInterval(async () => {
			try {
				const last = messages[messages.length - 1]?.timestampMs;
				const next = await window.api.chat.fetchMessages(
					selectedThreadId,
					last,
				);
				if (next.length > 0) {
					setMessages((prev) => {
						const ids = new Set(prev.map((m) => m.id));
						const merged = [...prev, ...next.filter((m) => !ids.has(m.id))];
						return merged.sort((a, b) => a.timestampMs - b.timestampMs);
					});
				}
			} catch {}
		}, 5000);
		return () => clearInterval(interval);
	}, [messages, selectedThreadId]);

	const openDm = useCallback(async () => {
		if (!window.api?.chat) return;
		if (!selectedFriendId) return;
		setBusy(true);
		setError(null);
		try {
			const threadId = await window.api.chat.openDmThread(selectedFriendId);
			await refreshThreads();
			setSelectedThreadId(threadId);
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	}, [refreshThreads, selectedFriendId]);

	const openProjectChat = useCallback(async () => {
		if (!window.api?.chat) return;
		if (!selectedRoomId) return;
		setBusy(true);
		setError(null);
		try {
			const threadId = await window.api.chat.openProjectThread(selectedRoomId);
			await refreshThreads();
			setSelectedThreadId(threadId);
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	}, [refreshThreads, selectedRoomId]);

	const send = useCallback(async () => {
		if (!window.api?.chat) return;
		if (!selectedThreadId) return;
		const trimmed = text.trim();
		if (!trimmed) return;
		setBusy(true);
		setError(null);
		try {
			await window.api.chat.sendMessage(selectedThreadId, trimmed);
			setText("");
			await refreshMessages(selectedThreadId);
		} catch (e) {
			setError(String(e));
		} finally {
			setBusy(false);
		}
	}, [refreshMessages, selectedThreadId, text]);

	const selectedThread = useMemo(
		() => threads.find((t) => t.id === selectedThreadId) ?? null,
		[selectedThreadId, threads],
	);

	if (!window.api?.chat) {
		return (
			<div className="text-sm text-muted-foreground">
				Chat features unavailable
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="text-xs font-mono tracking-[0.18em] text-muted-foreground">
					THREADS
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={refreshThreads}
					disabled={busy}
				>
					Refresh
				</Button>
			</div>

			{friends.length > 0 && (
				<div className="flex items-center gap-2">
					<select
						value={selectedFriendId}
						onChange={(e) => setSelectedFriendId(e.target.value)}
						className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
					>
						{friends.map((f) => (
							<option key={f.userId} value={f.userId}>
								@{f.username}
							</option>
						))}
					</select>
					<Button
						size="sm"
						onClick={openDm}
						disabled={busy || !selectedFriendId}
					>
						New DM
					</Button>
				</div>
			)}

			{rooms.length > 0 && (
				<div className="flex items-center gap-2">
					<select
						value={selectedRoomId}
						onChange={(e) => setSelectedRoomId(e.target.value)}
						className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
					>
						{rooms.map((r) => (
							<option key={r.id} value={r.id}>
								{r.name}
							</option>
						))}
					</select>
					<Button
						size="sm"
						variant="outline"
						onClick={openProjectChat}
						disabled={busy || !selectedRoomId}
					>
						Project chat
					</Button>
				</div>
			)}

			{error && (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			)}

			{threads.length === 0 ? (
				<div className="text-sm text-muted-foreground">No threads yet</div>
			) : (
				<div className="max-h-28 overflow-auto space-y-1">
					{threads.map((t) => {
						const active = t.id === selectedThreadId;
						return (
							<button
								key={t.id}
								type="button"
								onClick={() => setSelectedThreadId(t.id)}
								className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
									active
										? "border-primary/40 bg-primary/10 text-foreground"
										: "border-border bg-muted/10 text-foreground hover:bg-muted/20"
								}`}
							>
								{t.title}
							</button>
						);
					})}
				</div>
			)}

			{selectedThread && (
				<div className="space-y-2">
					<div className="text-xs font-mono tracking-[0.18em] text-muted-foreground">
						{selectedThread.title}
					</div>
					<div className="max-h-48 overflow-auto space-y-1 rounded-md border border-border bg-muted/10 px-3 py-2">
						{messages.length === 0 ? (
							<div className="text-sm text-muted-foreground">No messages</div>
						) : (
							messages.map((m) => (
								<div key={m.id} className="text-sm text-foreground">
									{m.text}
								</div>
							))
						)}
					</div>
					<div className="flex gap-2">
						<Input
							value={text}
							onChange={(e) => setText(e.target.value)}
							placeholder="Message"
						/>
						<Button size="sm" onClick={send} disabled={busy || !text.trim()}>
							Send
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
