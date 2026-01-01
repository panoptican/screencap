import { DOT_ALPHA_BY_LEVEL, type Rgb, rgba } from "@/lib/color";
import type { Event } from "@/types";

export type ActivityCategory =
	| "Study"
	| "Work"
	| "Leisure"
	| "Chores"
	| "Social"
	| "Unknown";

export type DaylineSlot = {
	startMs: number;
	count: number;
	category: ActivityCategory;
	addiction: string | null;
};

export const SLOT_MINUTES = 10;
export const SLOTS_PER_HOUR = 6;
export const SLOTS_PER_DAY = 24 * SLOTS_PER_HOUR;

export const CATEGORY_RGB = {
	Study: [59, 130, 246],
	Work: [34, 197, 94],
	Leisure: [168, 85, 247],
	Chores: [250, 204, 21],
	Social: [236, 72, 153],
	Unknown: [107, 114, 128],
} as const satisfies Record<ActivityCategory, Rgb>;

export function toCategory(value: string | null): ActivityCategory {
	if (value === "Study") return "Study";
	if (value === "Work") return "Work";
	if (value === "Leisure") return "Leisure";
	if (value === "Chores") return "Chores";
	if (value === "Social") return "Social";
	return "Unknown";
}

function eventAddictionLabel(e: Event): string | null {
	return e.trackedAddiction ?? e.addictionCandidate ?? null;
}

function dominantMapKey(m: Map<string, number>): string | null {
	let best: string | null = null;
	let bestCount = 0;
	for (const [k, v] of m) {
		if (v > bestCount) {
			best = k;
			bestCount = v;
		}
	}
	return best;
}

function dominantCategory(m: Map<ActivityCategory, number>): ActivityCategory {
	let best: ActivityCategory = "Unknown";
	let bestCount = 0;
	for (const [k, v] of m) {
		if (v > bestCount) {
			best = k;
			bestCount = v;
		}
	}
	return best;
}

export function slotLevel(count: number): 0 | 1 | 2 | 3 | 4 {
	if (count <= 0) return 0;
	if (count === 1) return 1;
	if (count === 2) return 2;
	if (count === 3) return 3;
	return 4;
}

export function computeDaylineSlots(
	events: Event[],
	dayStartMs: number,
): DaylineSlot[] {
	const slotMs = SLOT_MINUTES * 60 * 1000;
	const slots = Array.from({ length: SLOTS_PER_DAY }, (_, i) => ({
		startMs: dayStartMs + i * slotMs,
		count: 0,
		categoryCounts: new Map<ActivityCategory, number>(),
		addictionCounts: new Map<string, number>(),
	}));

	for (const e of events) {
		const index = Math.floor((e.timestamp - dayStartMs) / slotMs);
		if (index < 0 || index >= slots.length) continue;
		const slot = slots[index];
		slot.count += 1;
		const c = toCategory(e.category);
		slot.categoryCounts.set(c, (slot.categoryCounts.get(c) ?? 0) + 1);
		const addiction = eventAddictionLabel(e);
		if (addiction) {
			slot.addictionCounts.set(
				addiction,
				(slot.addictionCounts.get(addiction) ?? 0) + 1,
			);
		}
	}

	return slots.map(({ startMs, count, categoryCounts, addictionCounts }) => ({
		startMs,
		count,
		category: dominantCategory(categoryCounts),
		addiction: dominantMapKey(addictionCounts),
	}));
}

export function slotBackgroundColor(
	slot: DaylineSlot,
	level: 0 | 1 | 2 | 3 | 4,
): string | null {
	if (slot.count <= 0) return null;
	const alpha = DOT_ALPHA_BY_LEVEL[level];
	if (slot.addiction) return `hsl(var(--destructive) / ${alpha})`;
	return rgba(CATEGORY_RGB[slot.category], alpha);
}
