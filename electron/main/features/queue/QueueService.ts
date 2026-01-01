import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { isSelfApp } from "../../../shared/appIdentity";
import type { Event } from "../../../shared/types";
import {
	getEventById,
	updateEvent,
} from "../../infra/db/repositories/EventRepository";
import {
	getQueueItems,
	incrementAttempts,
	MAX_ATTEMPTS,
	removeFromQueue,
} from "../../infra/db/repositories/QueueRepository";
import { createLogger } from "../../infra/log";
import { getOriginalsDir } from "../../infra/paths";
import { getApiKey, getSettings } from "../../infra/settings";
import { broadcastEventUpdated } from "../../infra/windows";
import {
	evaluateAutomationPolicy,
	type PolicyResult,
} from "../automationRules";
import { classifyScreenshot, type ScreenContext } from "../llm";
import { canonicalizeProject } from "../projects";

const logger = createLogger({ scope: "QueueService" });

const PROCESS_INTERVAL_MS = 10_000;
const ITEM_DELAY_MS = 1000;

let processingInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

function extractScreenContext(event: {
	appBundleId: string | null;
	appName: string | null;
	windowTitle: string | null;
	urlHost: string | null;
	contentKind: string | null;
	contentTitle: string | null;
}): ScreenContext | null {
	if (
		!event.appBundleId &&
		!event.appName &&
		!event.windowTitle &&
		!event.urlHost &&
		!event.contentKind &&
		!event.contentTitle
	) {
		return null;
	}
	return {
		appBundleId: event.appBundleId,
		appName: event.appName,
		windowTitle: event.windowTitle,
		urlHost: event.urlHost,
		contentKind: event.contentKind,
		contentTitle: event.contentTitle,
	};
}

function highResPathForEventId(eventId: string): string {
	return join(getOriginalsDir(), `${eventId}.hq.png`);
}

function deleteHighResIfExists(eventId: string): void {
	const path = highResPathForEventId(eventId);
	try {
		if (existsSync(path)) unlinkSync(path);
	} catch {
		logger.warn("Failed to delete high-res capture", { eventId, path });
	}
}

function buildFallbackCaption(event: Event): string {
	const parts: string[] = [];
	if (event.contentTitle) {
		parts.push(event.contentTitle);
	} else if (event.windowTitle) {
		parts.push(event.windowTitle);
	}
	const appName = event.appName;
	if (appName && !parts.some((p) => p.includes(appName))) {
		parts.push(`in ${appName}`);
	}
	return parts.length > 0 ? parts.join(" ") : "Screenshot captured";
}

function finalizeEventLocally(event: Event, policy: PolicyResult): void {
	const updates: Partial<Event> = {
		status: "completed",
		caption: buildFallbackCaption(event),
	};

	if (policy.overrides.category) {
		updates.category = policy.overrides.category;
	}
	if (policy.overrides.tags) {
		updates.tags = JSON.stringify(policy.overrides.tags);
	}

	switch (policy.overrides.projectMode) {
		case "skip":
			updates.project = null;
			updates.projectProgress = 0;
			updates.projectProgressConfidence = null;
			updates.projectProgressEvidence = null;
			break;
		case "force":
			if (policy.overrides.project) {
				updates.project = policy.overrides.project;
			}
			break;
	}

	updateEvent(event.id, updates);
}

async function processQueueItem(item: {
	id: string;
	eventId: string;
	imageData: string;
}): Promise<void> {
	const attempts = incrementAttempts(item.id);

	try {
		const event = getEventById(item.eventId);
		if (!event) {
			removeFromQueue(item.id);
			logger.warn("Event not found for queue item, removing", {
				eventId: item.eventId,
			});
			return;
		}

		const settings = getSettings();
		const policy = evaluateAutomationPolicy(
			{ appBundleId: event.appBundleId, urlHost: event.urlHost },
			settings.automationRules,
		);

		if (policy.llm === "skip") {
			logger.debug(
				"Automation rule says skip LLM (post-enqueue), finalizing locally",
				{
					eventId: item.eventId,
				},
			);
			finalizeEventLocally(event, policy);
			deleteHighResIfExists(item.eventId);
			removeFromQueue(item.id);
			broadcastEventUpdated(item.eventId);
			return;
		}

		const context = extractScreenContext(event);
		const result = await classifyScreenshot(item.imageData, context);

		if (result) {
			const latest = getEventById(item.eventId);
			const hasManualCaption = (latest?.caption ?? "").trim().length > 0;
			const isManualProgress = latest?.projectProgressEvidence === "manual";
			const shouldDisableAddictionTracking = isSelfApp({
				bundleId: latest?.appBundleId ?? event.appBundleId,
				name: latest?.appName ?? event.appName,
				windowTitle: latest?.windowTitle ?? event.windowTitle,
			});
			if (
				shouldDisableAddictionTracking &&
				(result.tracked_addiction.detected || result.addiction_candidate)
			) {
				logger.debug("Meta screen detected, clearing addiction signals", {
					eventId: item.eventId,
				});
			}

			let project = canonicalizeProject(result.project);
			let progressShown = !!project && result.project_progress.shown;
			let resolvedProgress = isManualProgress ? 1 : progressShown ? 1 : 0;
			let resolvedEvidence: string | null = isManualProgress
				? "manual"
				: progressShown
					? "llm"
					: null;
			const resolvedCaption = hasManualCaption
				? (latest?.caption ?? null)
				: result.caption;

			let category = result.category;
			let tags = result.tags;

			if (policy.overrides.category) {
				category = policy.overrides.category;
			}
			if (policy.overrides.tags) {
				tags = policy.overrides.tags;
			}

			switch (policy.overrides.projectMode) {
				case "skip":
					project = null;
					progressShown = false;
					resolvedProgress = 0;
					resolvedEvidence = null;
					break;
				case "force":
					if (policy.overrides.project) {
						project = canonicalizeProject(policy.overrides.project);
					}
					break;
			}

			updateEvent(item.eventId, {
				category,
				subcategories: JSON.stringify(result.subcategories),
				project,
				projectProgress: resolvedProgress,
				projectProgressConfidence: progressShown
					? result.project_progress.confidence
					: null,
				projectProgressEvidence: resolvedEvidence,
				tags: JSON.stringify(tags),
				confidence: result.confidence,
				caption: resolvedCaption,
				trackedAddiction: shouldDisableAddictionTracking
					? null
					: result.tracked_addiction.detected
						? result.tracked_addiction.name
						: null,
				addictionCandidate: shouldDisableAddictionTracking
					? null
					: (result.addiction_candidate ?? null),
				addictionConfidence: shouldDisableAddictionTracking
					? null
					: (result.addiction_confidence ?? null),
				addictionPrompt: shouldDisableAddictionTracking
					? null
					: (result.addiction_prompt ?? null),
				status: "completed",
			});

			if (resolvedProgress !== 1) {
				deleteHighResIfExists(item.eventId);
			}

			removeFromQueue(item.id);
			broadcastEventUpdated(item.eventId);
			logger.debug("Processed queue item", { eventId: item.eventId });
		}
	} catch (error) {
		logger.error(`Failed to process queue item ${item.id}:`, error);

		if (attempts >= MAX_ATTEMPTS) {
			updateEvent(item.eventId, { status: "failed" });
			deleteHighResIfExists(item.eventId);
			removeFromQueue(item.id);
			logger.warn("Queue item exceeded max attempts", {
				id: item.id,
				eventId: item.eventId,
			});
		}
	}
}

async function processQueue(): Promise<void> {
	if (isProcessing) {
		logger.debug("Queue processing already in progress, skipping");
		return;
	}

	const settings = getSettings();

	if (!settings.llmEnabled) {
		logger.debug("LLM is disabled globally, finalizing queued items locally");
		await finalizeQueueLocally();
		return;
	}

	if (!getApiKey()) {
		logger.debug("No API key configured, skipping queue processing");
		return;
	}

	isProcessing = true;

	try {
		const items = getQueueItems();

		for (const item of items) {
			await processQueueItem(item);
			await new Promise((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
		}
	} finally {
		isProcessing = false;
	}
}

async function finalizeQueueLocally(): Promise<void> {
	const items = getQueueItems();
	for (const item of items) {
		const event = getEventById(item.eventId);
		if (!event) {
			removeFromQueue(item.id);
			continue;
		}
		const settings = getSettings();
		const policy = evaluateAutomationPolicy(
			{ appBundleId: event.appBundleId, urlHost: event.urlHost },
			settings.automationRules,
		);
		finalizeEventLocally(event, policy);
		removeFromQueue(item.id);
		broadcastEventUpdated(item.eventId);
	}
}

export function startQueueProcessor(): void {
	if (processingInterval) {
		clearInterval(processingInterval);
	}

	logger.info("Starting queue processor");

	processingInterval = setInterval(() => {
		processQueue();
	}, PROCESS_INTERVAL_MS);

	processQueue();
}

export function stopQueueProcessor(): void {
	if (processingInterval) {
		clearInterval(processingInterval);
		processingInterval = null;
		logger.info("Queue processor stopped");
	}
}

export function isQueueProcessorRunning(): boolean {
	return processingInterval !== null;
}

export function triggerQueueProcess(): void {
	processQueue();
}
