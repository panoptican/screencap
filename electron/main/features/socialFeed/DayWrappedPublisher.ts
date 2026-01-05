import { getLogicalDayStart } from "../../../shared/dayBoundary";
import { getEvents } from "../../infra/db/repositories/EventRepository";
import { createLogger } from "../../infra/log";
import { getSettings } from "../../infra/settings/SettingsStore";
import { encryptRoomEventPayload } from "../rooms/RoomCrypto";
import { getRoomKey } from "../rooms/RoomsService";
import { getIdentity, signedFetch } from "../social/IdentityService";
import {
	applyDayWrappedVisibility,
	buildDayWrappedRoomEventId,
	computeDayWrappedSlots,
} from "./dayWrapped";
import {
	DAY_WRAPPED_PAYLOAD_KIND,
	DAY_WRAPPED_PAYLOAD_VERSION,
	encodeDayWrappedRoomPayload,
} from "./dayWrappedPayload";
import { ensureFriendsFeedRoom } from "./FriendsFeedRoomService";

const logger = createLogger({ scope: "DayWrappedPublisher" });

const PUBLISH_INTERVAL_MS = 15 * 60 * 1000;

let interval: NodeJS.Timeout | null = null;
let inFlight = false;

async function publishOnce(): Promise<void> {
	const identity = getIdentity();
	if (!identity) return;

	const settings = getSettings();
	if (!settings.social.dayWrapped.enabled) return;

	if (inFlight) return;
	inFlight = true;

	try {
		const now = Date.now();
		const dayStartMs = getLogicalDayStart(now);
		const events = getEvents({ startDate: dayStartMs, endDate: now });
		if (events.length === 0) return;

		const slots = applyDayWrappedVisibility(
			computeDayWrappedSlots(events, dayStartMs),
			{
				includeApps: settings.social.dayWrapped.includeApps,
				includeAddiction: settings.social.dayWrapped.includeAddiction,
			},
		);

		const roomId = await ensureFriendsFeedRoom();
		const roomKey = await getRoomKey(roomId);

		const payloadCiphertext = encryptRoomEventPayload({
			roomKey,
			payloadJsonUtf8: encodeDayWrappedRoomPayload({
				kind: DAY_WRAPPED_PAYLOAD_KIND,
				v: DAY_WRAPPED_PAYLOAD_VERSION,
				dayStartMs,
				slots,
			}),
		});

		const eventId = buildDayWrappedRoomEventId({
			authorUserId: identity.userId,
			dayStartMs,
		});

		const res = await signedFetch(`/api/rooms/${roomId}/events`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ eventId, timestampMs: now, payloadCiphertext }),
		});

		if (!res.ok) {
			const text = await res.text();
			logger.warn("Day Wrapped publish failed", {
				roomId,
				eventId,
				status: res.status,
				body: text,
			});
			return;
		}

		logger.info("Published Day Wrapped", { roomId, eventId });
	} catch (error) {
		logger.warn("Day Wrapped publish error", { error: String(error) });
	} finally {
		inFlight = false;
	}
}

export function startDayWrappedPublisher(): void {
	if (interval) return;

	setTimeout(() => {
		void publishOnce();
	}, 20_000);

	interval = setInterval(() => {
		void publishOnce();
	}, PUBLISH_INTERVAL_MS);

	logger.info("Day Wrapped publisher started", {
		intervalMs: PUBLISH_INTERVAL_MS,
	});
}

export function stopDayWrappedPublisher(): void {
	if (!interval) return;
	clearInterval(interval);
	interval = null;
	logger.info("Day Wrapped publisher stopped");
}
