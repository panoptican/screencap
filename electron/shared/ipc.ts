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
} from "./types";

export const IpcChannels = {
	App: {
		Quit: "app:quit",
		CopyImage: "app:copy-image",
		GetInfo: "app:get-info",
		OpenExternal: "app:open-external",
		RevealInFinder: "app:reveal-in-finder",
	},
	Update: {
		GetState: "update:get-state",
		Check: "update:check",
		Download: "update:download",
		RestartAndInstall: "update:restart-and-install",
	},
	Window: {
		Minimize: "window:minimize",
		Maximize: "window:maximize",
		Show: "window:show",
		Close: "window:close",
	},
	Popup: {
		SetHeight: "popup:set-height",
	},
	Permissions: {
		CheckScreenCapture: "permissions:check-screen-capture",
		HasScreenCapture: "permissions:has-screen-capture",
		OpenSettings: "permissions:open-settings",
		GetAccessibility: "permissions:get-accessibility",
		RequestAccessibility: "permissions:request-accessibility",
		OpenAccessibilitySettings: "permissions:open-accessibility-settings",
		GetAutomation: "permissions:get-automation",
		OpenAutomationSettings: "permissions:open-automation-settings",
	},
	Context: {
		Test: "context:test",
		GetStatus: "context:get-status",
	},
	Capture: {
		AllDisplays: "capture:all-displays",
		Primary: "capture:primary",
		Trigger: "capture:trigger",
	},
	Scheduler: {
		Start: "scheduler:start",
		Stop: "scheduler:stop",
		IsRunning: "scheduler:is-running",
	},
	Storage: {
		GetEvents: "storage:get-events",
		GetEvent: "storage:get-event",
		GetEventScreenshots: "storage:get-event-screenshots",
		DismissEvents: "storage:dismiss-events",
		RelabelEvents: "storage:relabel-events",
		ConfirmAddiction: "storage:confirm-addiction",
		RejectAddiction: "storage:reject-addiction",
		SetEventCaption: "storage:set-event-caption",
		DeleteEvent: "storage:delete-event",
		GetMemories: "storage:get-memories",
		InsertMemory: "storage:insert-memory",
		UpdateMemory: "storage:update-memory",
		DeleteMemory: "storage:delete-memory",
		GetCategories: "storage:get-categories",
		GetProjects: "storage:get-projects",
		GetApps: "storage:get-apps",
		GetWebsites: "storage:get-websites",
		GetTimelineFacets: "storage:get-timeline-facets",
		GetStats: "storage:get-stats",
		GetStories: "storage:get-stories",
		InsertStory: "storage:insert-story",
	},
	Settings: {
		Get: "settings:get",
		Set: "settings:set",
	},
	LLM: {
		Classify: "llm:classify",
		GenerateStory: "llm:generate-story",
		TestConnection: "llm:test-connection",
	},
} as const;

export const IpcEvents = {
	PermissionRequired: "permission:required",
	EventCreated: "event:created",
	EventUpdated: "event:updated",
	EventsChanged: "events:changed",
	ProjectsNormalized: "projects:normalized",
	UpdateState: "update:state",
} as const;

export interface IpcInvokeHandlers {
	[IpcChannels.App.Quit]: () => void;
	[IpcChannels.App.CopyImage]: (path: string) => boolean;
	[IpcChannels.App.GetInfo]: () => AppInfo;
	[IpcChannels.App.OpenExternal]: (url: string) => void;
	[IpcChannels.App.RevealInFinder]: () => void;

	[IpcChannels.Update.GetState]: () => UpdateState;
	[IpcChannels.Update.Check]: () => void;
	[IpcChannels.Update.Download]: () => void;
	[IpcChannels.Update.RestartAndInstall]: () => void;

	[IpcChannels.Window.Minimize]: () => void;
	[IpcChannels.Window.Maximize]: () => void;
	[IpcChannels.Window.Show]: () => void;
	[IpcChannels.Window.Close]: () => void;

	[IpcChannels.Popup.SetHeight]: (height: number) => void;

	[IpcChannels.Permissions.CheckScreenCapture]: () => PermissionStatus;
	[IpcChannels.Permissions.HasScreenCapture]: () => boolean;
	[IpcChannels.Permissions.OpenSettings]: () => void;
	[IpcChannels.Permissions.GetAccessibility]: () => PermissionStatus;
	[IpcChannels.Permissions.RequestAccessibility]: () => boolean;
	[IpcChannels.Permissions.OpenAccessibilitySettings]: () => void;
	[IpcChannels.Permissions.GetAutomation]: () => AutomationStatus;
	[IpcChannels.Permissions.OpenAutomationSettings]: () => void;

	[IpcChannels.Context.Test]: () => Promise<ContextTestResult>;
	[IpcChannels.Context.GetStatus]: () => ContextStatus;

	[IpcChannels.Capture.AllDisplays]: () => Promise<CaptureResult[]>;
	[IpcChannels.Capture.Primary]: () => Promise<string | null>;
	[IpcChannels.Capture.Trigger]: (
		options?: CaptureTriggerOptions,
	) => Promise<CaptureTriggerResult>;

	[IpcChannels.Scheduler.Start]: (intervalMinutes?: number) => void;
	[IpcChannels.Scheduler.Stop]: () => void;
	[IpcChannels.Scheduler.IsRunning]: () => boolean;

	[IpcChannels.Storage.GetEvents]: (options: GetEventsOptions) => Event[];
	[IpcChannels.Storage.GetEvent]: (id: string) => Event | null;
	[IpcChannels.Storage.GetEventScreenshots]: (
		eventId: string,
	) => EventScreenshot[];
	[IpcChannels.Storage.DismissEvents]: (ids: string[]) => void;
	[IpcChannels.Storage.RelabelEvents]: (ids: string[], label: string) => void;
	[IpcChannels.Storage.ConfirmAddiction]: (ids: string[]) => void;
	[IpcChannels.Storage.RejectAddiction]: (ids: string[]) => void;
	[IpcChannels.Storage.SetEventCaption]: (id: string, caption: string) => void;
	[IpcChannels.Storage.DeleteEvent]: (id: string) => void;
	[IpcChannels.Storage.GetMemories]: (type?: string) => Memory[];
	[IpcChannels.Storage.InsertMemory]: (memory: Memory) => void;
	[IpcChannels.Storage.UpdateMemory]: (
		id: string,
		updates: { content: string; description?: string | null },
	) => void;
	[IpcChannels.Storage.DeleteMemory]: (id: string) => void;
	[IpcChannels.Storage.GetCategories]: () => string[];
	[IpcChannels.Storage.GetProjects]: () => string[];
	[IpcChannels.Storage.GetApps]: () => RecordedApp[];
	[IpcChannels.Storage.GetWebsites]: () => WebsiteEntry[];
	[IpcChannels.Storage.GetTimelineFacets]: (
		options: GetTimelineFacetsOptions,
	) => TimelineFacets;
	[IpcChannels.Storage.GetStats]: (
		startDate: number,
		endDate: number,
	) => CategoryStats[];
	[IpcChannels.Storage.GetStories]: (periodType?: string) => Story[];
	[IpcChannels.Storage.InsertStory]: (story: StoryInput) => void;

	[IpcChannels.Settings.Get]: () => Settings;
	[IpcChannels.Settings.Set]: (settings: Settings) => void;

	[IpcChannels.LLM.Classify]: (
		imageBase64: string,
	) => Promise<ClassificationResult | null>;
	[IpcChannels.LLM.GenerateStory]: (
		events: EventSummary[],
		periodType: PeriodType,
	) => Promise<string>;
	[IpcChannels.LLM.TestConnection]: () => Promise<LLMTestResult>;
}

export interface IpcEventPayloads {
	[IpcEvents.PermissionRequired]: undefined;
	[IpcEvents.EventCreated]: string;
	[IpcEvents.EventUpdated]: string;
	[IpcEvents.EventsChanged]: undefined;
	[IpcEvents.ProjectsNormalized]: { updatedRows: number; groups: number };
	[IpcEvents.UpdateState]: UpdateState;
}
