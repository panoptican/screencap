import { setTrayUnreadCount } from "../../app/tray";

const unreadByThread = new Map<string, number>();

function totalUnread(): number {
	let total = 0;
	for (const n of unreadByThread.values()) total += n;
	return total;
}

function syncTray(): void {
	setTrayUnreadCount(totalUnread());
}

export function addUnreadForThread(threadId: string, delta = 1): void {
	const d = Math.max(0, Math.trunc(delta));
	if (d === 0) return;
	const prev = unreadByThread.get(threadId) ?? 0;
	unreadByThread.set(threadId, prev + d);
	syncTray();
}

export function clearUnreadForThread(threadId: string): void {
	if (!unreadByThread.has(threadId)) return;
	unreadByThread.delete(threadId);
	syncTray();
}

export function resetAllUnread(): void {
	unreadByThread.clear();
	syncTray();
}

export function getUnreadTotal(): number {
	return totalUnread();
}
