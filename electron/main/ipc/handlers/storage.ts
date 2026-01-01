import { IpcChannels } from "../../../shared/ipc";
import type {
	GetEventsOptions,
	GetTimelineFacetsOptions,
	Memory,
	StoryInput,
} from "../../../shared/types";
import { ensureFavicon } from "../../features/favicons/FaviconService";
import { normalizeProjectsInDb } from "../../features/projects";
import {
	confirmAddiction,
	deleteEvent,
	dismissEvents,
	getCategoryStats,
	getDistinctApps,
	getDistinctAppsInRange,
	getDistinctCategories,
	getDistinctProjects,
	getDistinctProjectsInRange,
	getEventById,
	getEvents,
	rejectAddiction,
	relabelEvents,
	updateEvent,
} from "../../infra/db/repositories/EventRepository";
import { getEventScreenshots } from "../../infra/db/repositories/EventScreenshotRepository";
import {
	listWebsitesWithFavicons,
	listWebsitesWithFaviconsInRange,
} from "../../infra/db/repositories/FaviconRepository";
import {
	deleteMemory,
	getMemories,
	getMemoryType,
	insertMemory,
	updateMemory,
} from "../../infra/db/repositories/MemoryRepository";
import {
	getStories,
	insertStory,
} from "../../infra/db/repositories/StoryRepository";
import { createLogger } from "../../infra/log";
import {
	broadcastEventsChanged,
	broadcastEventUpdated,
	broadcastProjectsNormalized,
} from "../../infra/windows";
import { secureHandle } from "../secure";
import {
	ipcConfirmAddictionArgs,
	ipcDismissEventsArgs,
	ipcGetEventsArgs,
	ipcGetMemoriesArgs,
	ipcGetStatsArgs,
	ipcGetStoriesArgs,
	ipcGetTimelineFacetsArgs,
	ipcIdArgs,
	ipcInsertMemoryArgs,
	ipcInsertStoryArgs,
	ipcNoArgs,
	ipcRejectAddictionArgs,
	ipcRelabelEventsArgs,
	ipcSetEventCaptionArgs,
	ipcUpdateMemoryArgs,
} from "../validation";

const logger = createLogger({ scope: "StorageIPC" });

export function registerStorageHandlers(): void {
	secureHandle(
		IpcChannels.Storage.GetEvents,
		ipcGetEventsArgs,
		(options: GetEventsOptions) => {
			const result = getEvents(options);
			const missing = new Map<string, string | null>();
			for (const e of result) {
				if (e.urlHost && !e.faviconPath) {
					missing.set(e.urlHost, e.urlCanonical ?? null);
				}
			}
			missing.forEach((urlCanonical, host) => {
				void ensureFavicon(host, urlCanonical);
			});
			return result;
		},
	);

	secureHandle(IpcChannels.Storage.GetEvent, ipcIdArgs, (id: string) => {
		return getEventById(id);
	});

	secureHandle(
		IpcChannels.Storage.GetEventScreenshots,
		ipcIdArgs,
		(eventId: string) => {
			return getEventScreenshots(eventId);
		},
	);

	secureHandle(
		IpcChannels.Storage.DismissEvents,
		ipcDismissEventsArgs,
		(ids: string[]) => {
			dismissEvents(ids);
			if (ids.length > 0) broadcastEventsChanged();
		},
	);

	secureHandle(
		IpcChannels.Storage.RelabelEvents,
		ipcRelabelEventsArgs,
		(ids: string[], label: string) => {
			relabelEvents(ids, label);
			if (ids.length > 0) broadcastEventsChanged();
		},
	);

	secureHandle(
		IpcChannels.Storage.ConfirmAddiction,
		ipcConfirmAddictionArgs,
		(ids: string[]) => {
			confirmAddiction(ids);
			if (ids.length > 0) broadcastEventsChanged();
		},
	);

	secureHandle(
		IpcChannels.Storage.RejectAddiction,
		ipcRejectAddictionArgs,
		(ids: string[]) => {
			rejectAddiction(ids);
			if (ids.length > 0) broadcastEventsChanged();
		},
	);

	secureHandle(
		IpcChannels.Storage.SetEventCaption,
		ipcSetEventCaptionArgs,
		(id: string, caption: string) => {
			const next = caption.trim();
			if (!next) return;
			updateEvent(id, { caption: next });
			broadcastEventUpdated(id);
		},
	);

	secureHandle(IpcChannels.Storage.DeleteEvent, ipcIdArgs, (id: string) => {
		deleteEvent(id);
		broadcastEventsChanged();
	});

	secureHandle(
		IpcChannels.Storage.GetMemories,
		ipcGetMemoriesArgs,
		(type?: string) => {
			return getMemories(type);
		},
	);

	secureHandle(
		IpcChannels.Storage.InsertMemory,
		ipcInsertMemoryArgs,
		(memory: Memory) => {
			insertMemory(memory);

			if (memory.type === "project") {
				const result = normalizeProjectsInDb();
				if (result.updatedRows > 0) {
					logger.info("Normalized projects after memory insert", result);
				}
				broadcastProjectsNormalized(result);
			}
		},
	);

	secureHandle(
		IpcChannels.Storage.UpdateMemory,
		ipcUpdateMemoryArgs,
		(id: string, updates: { content: string; description?: string | null }) => {
			const type = getMemoryType(id);
			updateMemory(id, updates);

			if (type === "project") {
				const result = normalizeProjectsInDb();
				if (result.updatedRows > 0) {
					logger.info("Normalized projects after memory update", result);
				}
				broadcastProjectsNormalized(result);
			}
		},
	);

	secureHandle(IpcChannels.Storage.DeleteMemory, ipcIdArgs, (id: string) => {
		const type = getMemoryType(id);
		deleteMemory(id);

		if (type === "project") {
			const result = normalizeProjectsInDb();
			if (result.updatedRows > 0) {
				logger.info("Normalized projects after memory delete", result);
			}
			broadcastProjectsNormalized(result);
		}
	});

	secureHandle(IpcChannels.Storage.GetCategories, ipcNoArgs, () => {
		return getDistinctCategories();
	});

	secureHandle(IpcChannels.Storage.GetProjects, ipcNoArgs, () => {
		return getDistinctProjects();
	});

	secureHandle(IpcChannels.Storage.GetApps, ipcNoArgs, () => {
		return getDistinctApps();
	});

	secureHandle(IpcChannels.Storage.GetWebsites, ipcNoArgs, () => {
		const result = listWebsitesWithFavicons();
		for (const w of result) {
			if (!w.faviconPath) {
				void ensureFavicon(w.host, null);
			}
		}
		return result;
	});

	secureHandle(
		IpcChannels.Storage.GetTimelineFacets,
		ipcGetTimelineFacetsArgs,
		(options: GetTimelineFacetsOptions) => {
			const projects = getDistinctProjectsInRange(options);
			const websites = listWebsitesWithFaviconsInRange(options);
			const apps = getDistinctAppsInRange(options);
			for (const w of websites) {
				if (!w.faviconPath) {
					void ensureFavicon(w.host, null);
				}
			}
			return { projects, websites, apps };
		},
	);

	secureHandle(
		IpcChannels.Storage.GetStats,
		ipcGetStatsArgs,
		(startDate: number, endDate: number) => {
			return getCategoryStats(startDate, endDate);
		},
	);

	secureHandle(
		IpcChannels.Storage.GetStories,
		ipcGetStoriesArgs,
		(periodType?: string) => {
			return getStories(periodType);
		},
	);

	secureHandle(
		IpcChannels.Storage.InsertStory,
		ipcInsertStoryArgs,
		(story: StoryInput) => {
			insertStory(story);
		},
	);
}
