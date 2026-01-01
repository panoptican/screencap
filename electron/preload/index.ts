import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels, IpcEvents } from "../shared/ipc";
import type {
	AppInfo,
	AutomationStatus,
	CaptureResult,
	CaptureTriggerOptions,
	CaptureTriggerResult,
	CategoryStats,
	ClassificationResult,
	ContextStatus,
	ContextTestResult,
	Event,
	EventScreenshot,
	EventSummary,
	GetEventsOptions,
	GetTimelineFacetsOptions,
	LLMTestResult,
	Memory,
	PeriodType,
	PermissionStatus,
	RecordedApp,
	Settings,
	Story,
	StoryInput,
	TimelineFacets,
	UpdateState,
	WebsiteEntry,
} from "../shared/types";

const allowedEventChannels = new Set<string>(Object.values(IpcEvents));

const api = {
	app: {
		quit: () => ipcRenderer.invoke(IpcChannels.App.Quit),
		copyImage: (path: string): Promise<boolean> =>
			ipcRenderer.invoke(IpcChannels.App.CopyImage, path),
		getInfo: (): Promise<AppInfo> =>
			ipcRenderer.invoke(IpcChannels.App.GetInfo),
		openExternal: (url: string): Promise<void> =>
			ipcRenderer.invoke(IpcChannels.App.OpenExternal, url),
		revealInFinder: (): Promise<void> =>
			ipcRenderer.invoke(IpcChannels.App.RevealInFinder),
	},
	update: {
		getState: (): Promise<UpdateState> =>
			ipcRenderer.invoke(IpcChannels.Update.GetState),
		check: (): Promise<void> => ipcRenderer.invoke(IpcChannels.Update.Check),
		download: (): Promise<void> =>
			ipcRenderer.invoke(IpcChannels.Update.Download),
		restartAndInstall: (): Promise<void> =>
			ipcRenderer.invoke(IpcChannels.Update.RestartAndInstall),
	},
	window: {
		minimize: () => ipcRenderer.invoke(IpcChannels.Window.Minimize),
		maximize: () => ipcRenderer.invoke(IpcChannels.Window.Maximize),
		show: () => ipcRenderer.invoke(IpcChannels.Window.Show),
		close: () => ipcRenderer.invoke(IpcChannels.Window.Close),
	},
	popup: {
		setHeight: (height: number) =>
			ipcRenderer.invoke(IpcChannels.Popup.SetHeight, height),
	},

	permissions: {
		checkScreenCapture: (): Promise<PermissionStatus> =>
			ipcRenderer.invoke(IpcChannels.Permissions.CheckScreenCapture),
		hasScreenCapture: (): Promise<boolean> =>
			ipcRenderer.invoke(IpcChannels.Permissions.HasScreenCapture),
		openSettings: () =>
			ipcRenderer.invoke(IpcChannels.Permissions.OpenSettings),
		getAccessibility: (): Promise<PermissionStatus> =>
			ipcRenderer.invoke(IpcChannels.Permissions.GetAccessibility),
		requestAccessibility: (): Promise<boolean> =>
			ipcRenderer.invoke(IpcChannels.Permissions.RequestAccessibility),
		openAccessibilitySettings: () =>
			ipcRenderer.invoke(IpcChannels.Permissions.OpenAccessibilitySettings),
		getAutomation: (): Promise<AutomationStatus> =>
			ipcRenderer.invoke(IpcChannels.Permissions.GetAutomation),
		openAutomationSettings: () =>
			ipcRenderer.invoke(IpcChannels.Permissions.OpenAutomationSettings),
	},

	context: {
		test: (): Promise<ContextTestResult> =>
			ipcRenderer.invoke(IpcChannels.Context.Test),
		getStatus: (): Promise<ContextStatus> =>
			ipcRenderer.invoke(IpcChannels.Context.GetStatus),
	},

	capture: {
		allDisplays: (): Promise<CaptureResult[]> =>
			ipcRenderer.invoke(IpcChannels.Capture.AllDisplays),
		primary: (): Promise<string | null> =>
			ipcRenderer.invoke(IpcChannels.Capture.Primary),
		trigger: (
			options?: CaptureTriggerOptions,
		): Promise<CaptureTriggerResult> => {
			if (options) {
				return ipcRenderer.invoke(IpcChannels.Capture.Trigger, options);
			}
			return ipcRenderer.invoke(IpcChannels.Capture.Trigger);
		},
	},

	scheduler: {
		start: (intervalMinutes?: number) =>
			ipcRenderer.invoke(IpcChannels.Scheduler.Start, intervalMinutes),
		stop: () => ipcRenderer.invoke(IpcChannels.Scheduler.Stop),
		isRunning: (): Promise<boolean> =>
			ipcRenderer.invoke(IpcChannels.Scheduler.IsRunning),
	},

	storage: {
		getEvents: (options: GetEventsOptions): Promise<Event[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetEvents, options),
		getEvent: (id: string): Promise<Event | null> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetEvent, id),
		getEventScreenshots: (eventId: string): Promise<EventScreenshot[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetEventScreenshots, eventId),
		dismissEvents: (ids: string[]) =>
			ipcRenderer.invoke(IpcChannels.Storage.DismissEvents, ids),
		relabelEvents: (ids: string[], label: string) =>
			ipcRenderer.invoke(IpcChannels.Storage.RelabelEvents, ids, label),
		confirmAddiction: (ids: string[]) =>
			ipcRenderer.invoke(IpcChannels.Storage.ConfirmAddiction, ids),
		rejectAddiction: (ids: string[]) =>
			ipcRenderer.invoke(IpcChannels.Storage.RejectAddiction, ids),
		setEventCaption: (id: string, caption: string) =>
			ipcRenderer.invoke(IpcChannels.Storage.SetEventCaption, id, caption),
		deleteEvent: (id: string) =>
			ipcRenderer.invoke(IpcChannels.Storage.DeleteEvent, id),
		getMemories: (type?: string): Promise<Memory[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetMemories, type),
		insertMemory: (memory: Memory) =>
			ipcRenderer.invoke(IpcChannels.Storage.InsertMemory, memory),
		updateMemory: (
			id: string,
			updates: { content: string; description?: string | null },
		) => ipcRenderer.invoke(IpcChannels.Storage.UpdateMemory, id, updates),
		deleteMemory: (id: string) =>
			ipcRenderer.invoke(IpcChannels.Storage.DeleteMemory, id),
		getCategories: (): Promise<string[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetCategories),
		getProjects: (): Promise<string[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetProjects),
		getApps: (): Promise<RecordedApp[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetApps),
		getWebsites: (): Promise<WebsiteEntry[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetWebsites),
		getTimelineFacets: (
			options: GetTimelineFacetsOptions,
		): Promise<TimelineFacets> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetTimelineFacets, options),
		getStats: (startDate: number, endDate: number): Promise<CategoryStats[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetStats, startDate, endDate),
		getStories: (periodType?: string): Promise<Story[]> =>
			ipcRenderer.invoke(IpcChannels.Storage.GetStories, periodType),
		insertStory: (story: StoryInput) =>
			ipcRenderer.invoke(IpcChannels.Storage.InsertStory, story),
	},

	settings: {
		get: (): Promise<Settings> => ipcRenderer.invoke(IpcChannels.Settings.Get),
		set: (settings: Settings) =>
			ipcRenderer.invoke(IpcChannels.Settings.Set, settings),
	},

	llm: {
		classify: (imageBase64: string): Promise<ClassificationResult | null> =>
			ipcRenderer.invoke(IpcChannels.LLM.Classify, imageBase64),
		generateStory: (
			events: EventSummary[],
			periodType: PeriodType,
		): Promise<string> =>
			ipcRenderer.invoke(IpcChannels.LLM.GenerateStory, events, periodType),
		testConnection: (): Promise<LLMTestResult> =>
			ipcRenderer.invoke(IpcChannels.LLM.TestConnection),
	},

	on: (channel: string, callback: (...args: unknown[]) => void) => {
		if (!allowedEventChannels.has(channel)) {
			throw new Error("Invalid event channel");
		}
		const subscription = (
			_event: Electron.IpcRendererEvent,
			...args: unknown[]
		) => callback(...args);
		ipcRenderer.on(channel, subscription);
		return () => ipcRenderer.removeListener(channel, subscription);
	},
};

contextBridge.exposeInMainWorld("api", api);

export type API = typeof api;

export {
	IpcChannels,
	IpcEvents,
	type Event,
	type EventScreenshot,
	type Memory,
	type Settings,
	type Story,
	type PermissionStatus,
	type GetEventsOptions,
	type CategoryStats,
	type StoryInput,
	type EventSummary,
	type PeriodType,
	type LLMTestResult,
	type CaptureResult,
	type ClassificationResult,
	type AutomationStatus,
	type ContextTestResult,
	type ContextStatus,
	type AppInfo,
	type UpdateState,
};
