import type { AutomationCategory, DayWrappedSlot } from "../../../shared/types";
import { DAY_WRAPPED_SLOTS_PER_DAY } from "./dayWrapped";

export const DAY_WRAPPED_PAYLOAD_KIND = "day_wrapped" as const;
export const DAY_WRAPPED_PAYLOAD_VERSION = 1 as const;

export type DayWrappedRoomPayload = {
	kind: typeof DAY_WRAPPED_PAYLOAD_KIND;
	v: typeof DAY_WRAPPED_PAYLOAD_VERSION;
	dayStartMs: number;
	slots: DayWrappedSlot[];
};

export function encodeDayWrappedRoomPayload(
	payload: DayWrappedRoomPayload,
): Uint8Array {
	return Buffer.from(JSON.stringify(payload), "utf8");
}

function isAutomationCategory(value: unknown): value is AutomationCategory {
	if (value === "Study") return true;
	if (value === "Work") return true;
	if (value === "Leisure") return true;
	if (value === "Chores") return true;
	if (value === "Social") return true;
	if (value === "Unknown") return true;
	return false;
}

function parseNullableString(value: unknown, maxLen: number): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.length > maxLen) return trimmed.slice(0, maxLen);
	return trimmed;
}

function parseNonNegativeInt(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	const n = Math.trunc(value);
	if (n < 0) return null;
	return n;
}

export function parseDayWrappedRoomPayload(
	value: unknown,
): DayWrappedRoomPayload | null {
	if (!value || typeof value !== "object") return null;
	const obj = value as Record<string, unknown>;

	if (obj.kind !== DAY_WRAPPED_PAYLOAD_KIND) return null;
	if (obj.v !== DAY_WRAPPED_PAYLOAD_VERSION) return null;

	const dayStartMs = parseNonNegativeInt(obj.dayStartMs);
	if (!dayStartMs) return null;

	const slotsRaw = obj.slots;
	if (
		!Array.isArray(slotsRaw) ||
		slotsRaw.length !== DAY_WRAPPED_SLOTS_PER_DAY
	) {
		return null;
	}

	const slots: DayWrappedSlot[] = [];
	for (const raw of slotsRaw) {
		if (!raw || typeof raw !== "object") return null;
		const s = raw as Record<string, unknown>;

		const startMs = parseNonNegativeInt(s.startMs);
		if (startMs === null) return null;

		const count = parseNonNegativeInt(s.count);
		if (count === null) return null;

		const category = s.category;
		if (!isAutomationCategory(category)) return null;

		slots.push({
			startMs,
			count,
			category,
			addiction: parseNullableString(s.addiction, 200),
			appName: parseNullableString(s.appName, 200),
		});
	}

	return {
		kind: DAY_WRAPPED_PAYLOAD_KIND,
		v: DAY_WRAPPED_PAYLOAD_VERSION,
		dayStartMs,
		slots,
	};
}
