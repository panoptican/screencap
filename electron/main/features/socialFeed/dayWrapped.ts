import { createHash } from "node:crypto";
import type {
	AutomationCategory,
	DayWrappedSlot,
	Event,
} from "../../../shared/types";

export const DAY_WRAPPED_SLOTS_PER_DAY = 144;
const SLOT_MINUTES = 10;

function toCategory(value: string | null): AutomationCategory {
	if (value === "Study") return "Study";
	if (value === "Work") return "Work";
	if (value === "Leisure") return "Leisure";
	if (value === "Chores") return "Chores";
	if (value === "Social") return "Social";
	return "Unknown";
}

function dominantKey(m: Map<string, number>): string | null {
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

function dominantCategory(
	m: Map<AutomationCategory, number>,
): AutomationCategory {
	let best: AutomationCategory = "Unknown";
	let bestCount = 0;
	for (const [k, v] of m) {
		if (v > bestCount) {
			best = k;
			bestCount = v;
		}
	}
	return best;
}

export function computeDayWrappedSlots(
	events: Event[],
	dayStartMs: number,
): DayWrappedSlot[] {
	const slotMs = SLOT_MINUTES * 60 * 1000;
	const slots = Array.from({ length: DAY_WRAPPED_SLOTS_PER_DAY }, (_, i) => ({
		startMs: dayStartMs + i * slotMs,
		count: 0,
		categoryCounts: new Map<AutomationCategory, number>(),
		addictionCounts: new Map<string, number>(),
		appCounts: new Map<string, number>(),
	}));

	for (const e of events) {
		const idx = Math.floor((e.timestamp - dayStartMs) / slotMs);
		if (idx < 0 || idx >= slots.length) continue;
		const slot = slots[idx];
		slot.count += 1;

		const category = toCategory(e.category);
		slot.categoryCounts.set(
			category,
			(slot.categoryCounts.get(category) ?? 0) + 1,
		);

		const addiction = e.trackedAddiction ?? e.addictionCandidate ?? null;
		if (addiction) {
			slot.addictionCounts.set(
				addiction,
				(slot.addictionCounts.get(addiction) ?? 0) + 1,
			);
		}

		if (e.appName) {
			slot.appCounts.set(e.appName, (slot.appCounts.get(e.appName) ?? 0) + 1);
		}
	}

	return slots.map(
		({ startMs, count, categoryCounts, addictionCounts, appCounts }) => ({
			startMs,
			count,
			category: dominantCategory(categoryCounts),
			addiction: dominantKey(addictionCounts),
			appName: dominantKey(appCounts),
		}),
	);
}

export function applyDayWrappedVisibility(
	slots: DayWrappedSlot[],
	params: { includeApps: boolean; includeAddiction: boolean },
): DayWrappedSlot[] {
	if (params.includeApps && params.includeAddiction) return slots;
	return slots.map((s) => ({
		...s,
		appName: params.includeApps ? s.appName : null,
		addiction: params.includeAddiction ? s.addiction : null,
	}));
}

function shortHashHex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

export function buildDayWrappedRoomEventId(params: {
	authorUserId: string;
	dayStartMs: number;
}): string {
	return `dw_${shortHashHex(params.authorUserId)}_${params.dayStartMs}`;
}
