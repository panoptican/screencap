import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 7) {
		return new Date(timestamp).toLocaleDateString();
	}
	if (days > 0) {
		return `${days}d ago`;
	}
	if (hours > 0) {
		return `${hours}h ago`;
	}
	if (minutes > 0) {
		return `${minutes}m ago`;
	}
	return "Just now";
}

export function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function groupEventsByDate<T extends { timestamp: number }>(
	events: T[],
): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	for (const event of events) {
		const date = new Date(event.timestamp);
		let key: string;

		if (date.toDateString() === today.toDateString()) {
			key = "Today";
		} else if (date.toDateString() === yesterday.toDateString()) {
			key = "Yesterday";
		} else {
			key = formatDate(event.timestamp);
		}

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key)?.push(event);
	}

	return groups;
}

export function getCategoryColor(category: string | null): string {
	switch (category) {
		case "Study":
			return "bg-blue-500/20 text-blue-400 border-blue-500/30";
		case "Work":
			return "bg-green-500/20 text-green-400 border-green-500/30";
		case "Leisure":
			return "bg-purple-500/20 text-purple-400 border-purple-500/30";
		case "Chores":
			return "bg-orange-500/20 text-orange-400 border-orange-500/30";
		case "Social":
			return "bg-pink-500/20 text-pink-400 border-pink-500/30";
		default:
			return "bg-gray-500/20 text-gray-400 border-gray-500/30";
	}
}

export function getConfidenceColor(confidence: number | null): string {
	if (confidence === null) return "text-muted-foreground";
	if (confidence >= 0.8) return "text-green-400";
	if (confidence >= 0.5) return "text-yellow-400";
	return "text-red-400";
}
