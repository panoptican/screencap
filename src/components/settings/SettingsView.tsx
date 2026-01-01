import {
	AlertCircle,
	Bot,
	Camera,
	Check,
	Copy,
	Database,
	Download,
	ExternalLink,
	Eye,
	FolderOpen,
	Info,
	Loader2,
	Play,
	RefreshCw,
	RotateCcw,
	SlidersHorizontal,
	Square,
	Workflow,
	X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Panel } from "@/components/wrapped/Panel";
import { useSettings } from "@/hooks/useSettings";
import type {
	AppInfo,
	AutomationCategory,
	AutomationRule,
	ContextStatus,
	ContextTestResult,
	RecordedApp,
	Settings,
	UpdateState,
	WebsiteEntry,
} from "@/types";

type PermissionStatusType = "granted" | "denied" | "not-determined";

type RuleType = "apps" | "hosts";

interface RuleRowProps {
	ruleKey: string;
	rule: AutomationRule;
	onUpdate: (key: string, updates: Partial<AutomationRule>) => void;
	onDelete: (key: string) => void;
}

const CATEGORIES: AutomationCategory[] = [
	"Work",
	"Study",
	"Leisure",
	"Chores",
	"Social",
	"Unknown",
];

function SettingsTabHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-lg font-medium">{title}</h2>
			<p className="text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

function SettingsRows({ children }: { children: ReactNode }) {
	return <div className="divide-y divide-border/60">{children}</div>;
}

function SettingsRow({
	title,
	description,
	right,
}: {
	title: string;
	description?: string;
	right: ReactNode;
}) {
	return (
		<div className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
			<div className="space-y-1">
				<div className="text-sm font-medium">{title}</div>
				{description ? (
					<div className="text-xs text-muted-foreground">{description}</div>
				) : null}
			</div>
			<div className="sm:justify-self-end">{right}</div>
		</div>
	);
}

function RuleRow({ ruleKey, rule, onUpdate, onDelete }: RuleRowProps) {
	return (
		<div className="p-3 rounded-lg bg-muted/50 space-y-3">
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-medium truncate flex-1">{ruleKey}</span>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 shrink-0"
					onClick={() => onDelete(ruleKey)}
				>
					<X className="h-3 w-3" />
				</Button>
			</div>
			<TooltipProvider>
				<div className="flex flex-wrap gap-4 text-xs">
					<label className="flex items-center gap-2">
						<Switch
							checked={rule.capture === "skip"}
							onCheckedChange={(checked) =>
								onUpdate(ruleKey, { capture: checked ? "skip" : "allow" })
							}
						/>
						<span className="text-muted-foreground">Skip capture</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
							</TooltipTrigger>
							<TooltipContent
								side="top"
								className="max-w-[240px] bg-card text-card-foreground border"
							>
								<p>
									When enabled, scheduled captures are skipped entirely when
									this app/site is focused. No screenshot is taken.
								</p>
							</TooltipContent>
						</Tooltip>
					</label>
					<label className="flex items-center gap-2">
						<Switch
							checked={rule.llm === "skip"}
							onCheckedChange={(checked) =>
								onUpdate(ruleKey, { llm: checked ? "skip" : "allow" })
							}
						/>
						<span className="text-muted-foreground">Skip LLM</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
							</TooltipTrigger>
							<TooltipContent
								side="top"
								className="max-w-[240px] bg-card text-card-foreground border"
							>
								<p>
									When enabled, screenshots are still captured locally, but not
									sent to AI for classification. Set a category below to label
									them automatically.
								</p>
							</TooltipContent>
						</Tooltip>
					</label>
				</div>
			</TooltipProvider>
			{rule.llm === "skip" && (
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">Category:</span>
					<Select
						value={rule.category ?? "__none__"}
						onValueChange={(value) =>
							onUpdate(ruleKey, {
								category:
									value === "__none__"
										? undefined
										: (value as AutomationCategory),
							})
						}
					>
						<SelectTrigger className="h-7 w-[120px] text-xs">
							<SelectValue placeholder="None" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__none__">None</SelectItem>
							{CATEGORIES.map((cat) => (
								<SelectItem key={cat} value={cat}>
									{cat}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}
		</div>
	);
}

function AutomationRulesSection() {
	const { settings, saveSettings } = useSettings();
	const [recordedApps, setRecordedApps] = useState<RecordedApp[]>([]);
	const [recordedHosts, setRecordedHosts] = useState<WebsiteEntry[]>([]);

	useEffect(() => {
		const load = async () => {
			const facets = await window.api.storage.getTimelineFacets({});
			setRecordedApps(facets.apps);
			setRecordedHosts(facets.websites);
		};
		void load();
	}, []);

	const updateRule = useCallback(
		async (
			ruleType: RuleType,
			key: string,
			updates: Partial<AutomationRule>,
		) => {
			const existingRule = settings.automationRules[ruleType][key] ?? {};
			const newRule: AutomationRule = { ...existingRule, ...updates };
			const newSettings: Settings = {
				...settings,
				automationRules: {
					...settings.automationRules,
					[ruleType]: {
						...settings.automationRules[ruleType],
						[key]: newRule,
					},
				},
			};
			await saveSettings(newSettings);
		},
		[settings, saveSettings],
	);

	const deleteRule = useCallback(
		async (ruleType: RuleType, key: string) => {
			const { [key]: _, ...rest } = settings.automationRules[ruleType];
			const newSettings: Settings = {
				...settings,
				automationRules: {
					...settings.automationRules,
					[ruleType]: rest,
				},
			};
			await saveSettings(newSettings);
		},
		[settings, saveSettings],
	);

	const addAppRule = useCallback(
		async (bundleId: string) => {
			if (!bundleId) return;
			await updateRule("apps", bundleId, { llm: "skip" });
		},
		[updateRule],
	);

	const addHostRule = useCallback(
		async (host: string) => {
			if (!host) return;
			await updateRule("hosts", host, { llm: "skip" });
		},
		[updateRule],
	);

	const appEntries = Object.entries(settings.automationRules?.apps ?? {});
	const hostEntries = Object.entries(settings.automationRules?.hosts ?? {});

	const configuredAppIds = new Set(appEntries.map(([k]) => k));
	const configuredHosts = new Set(hostEntries.map(([k]) => k));

	const availableApps = recordedApps.filter(
		(app) => !configuredAppIds.has(app.bundleId),
	);
	const availableHosts = recordedHosts.filter(
		(site) => !configuredHosts.has(site.host),
	);

	return (
		<Panel
			title="Automation"
			meta="Skip capture or AI processing for specific apps or websites"
		>
			<div className="grid gap-6 md:grid-cols-2">
				<div className="space-y-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="text-sm font-medium">Apps</div>
						{availableApps.length > 0 ? (
							<Select onValueChange={addAppRule}>
								<SelectTrigger className="h-8 w-full sm:w-[220px]">
									<SelectValue placeholder="Add app..." />
								</SelectTrigger>
								<SelectContent>
									{availableApps.map((app) => (
										<SelectItem key={app.bundleId} value={app.bundleId}>
											{app.name ?? app.bundleId}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}
					</div>
					{appEntries.length === 0 ? (
						<div className="text-xs text-muted-foreground">
							No app rules configured.
						</div>
					) : (
						<div className="space-y-2">
							{appEntries.map(([key, rule]) => {
								const app = recordedApps.find((a) => a.bundleId === key);
								return (
									<RuleRow
										key={key}
										ruleKey={app?.name ?? key}
										rule={rule}
										onUpdate={(_, updates) => updateRule("apps", key, updates)}
										onDelete={() => deleteRule("apps", key)}
									/>
								);
							})}
						</div>
					)}
				</div>

				<div className="space-y-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="text-sm font-medium">Websites</div>
						{availableHosts.length > 0 ? (
							<Select onValueChange={addHostRule}>
								<SelectTrigger className="h-8 w-full sm:w-[220px]">
									<SelectValue placeholder="Add website..." />
								</SelectTrigger>
								<SelectContent>
									{availableHosts.map((site) => (
										<SelectItem key={site.host} value={site.host}>
											{site.host}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}
					</div>
					{hostEntries.length === 0 ? (
						<div className="text-xs text-muted-foreground">
							No website rules configured.
						</div>
					) : (
						<div className="space-y-2">
							{hostEntries.map(([key, rule]) => (
								<RuleRow
									key={key}
									ruleKey={key}
									rule={rule}
									onUpdate={(_, updates) => updateRule("hosts", key, updates)}
									onDelete={() => deleteRule("hosts", key)}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</Panel>
	);
}

function PermissionBadge({
	status,
	label,
}: {
	status: PermissionStatusType;
	label: string;
}) {
	const colors = {
		granted: "bg-green-500/10 text-green-500",
		denied: "bg-destructive/10 text-destructive",
		"not-determined": "bg-yellow-500/10 text-yellow-500",
	};
	const labels = {
		granted: "Granted",
		denied: "Denied",
		"not-determined": "Not Set",
	};
	return (
		<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
			<span className="text-sm">{label}</span>
			<span className={`text-xs px-2 py-1 rounded-full ${colors[status]}`}>
				{labels[status]}
			</span>
		</div>
	);
}

export function SettingsView() {
	const { settings, updateSetting, saveSettings } = useSettings();
	const [apiKey, setApiKey] = useState(settings.apiKey || "");
	const [isTesting, setIsTesting] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		error?: string;
	} | null>(null);
	const [screenshotTest, setScreenshotTest] = useState<{
		status: "idle" | "loading" | "success" | "error";
		message?: string;
		image?: string;
	}>({ status: "idle" });
	const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
	const [contextStatus, setContextStatus] = useState<ContextStatus | null>(
		null,
	);
	const [contextTest, setContextTest] = useState<{
		status: "idle" | "loading" | "success" | "error";
		result?: ContextTestResult;
	}>({ status: "idle" });
	const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
	const [updateState, setUpdateState] = useState<UpdateState | null>(null);

	useEffect(() => {
		if (!window.api) return;

		const checkScheduler = async () => {
			const running = await window.api.scheduler.isRunning();
			setIsSchedulerRunning(running);
		};
		const loadContextStatus = async () => {
			const status = await window.api.context.getStatus();
			setContextStatus(status);
		};
		const loadAppInfo = async () => {
			const info = await window.api.app.getInfo();
			setAppInfo(info);
		};
		const loadUpdateState = async () => {
			const state = await window.api.update.getState();
			setUpdateState(state);
		};
		checkScheduler();
		loadContextStatus();
		loadAppInfo();
		loadUpdateState();
		const interval = setInterval(() => {
			checkScheduler();
			loadContextStatus();
		}, 2000);
		const unsubscribe = window.api.on("update:state", (state) => {
			setUpdateState(state as UpdateState);
		});
		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	}, []);

	const handleSaveApiKey = async () => {
		await updateSetting("apiKey", apiKey || null);
		setTestResult(null);
	};

	const handleTestConnection = async () => {
		if (!apiKey || !window.api) return;

		await updateSetting("apiKey", apiKey);
		setIsTesting(true);
		setTestResult(null);

		try {
			const result = await window.api.llm.testConnection();
			setTestResult(result);
		} catch (error) {
			setTestResult({ success: false, error: String(error) });
		} finally {
			setIsTesting(false);
		}
	};

	const handleTestScreenshot = async () => {
		if (!window.api) return;
		setScreenshotTest({ status: "loading" });
		try {
			const imageBase64 = await window.api.capture.primary();
			if (imageBase64) {
				setScreenshotTest({
					status: "success",
					message: `Screenshot captured! Size: ${Math.round(imageBase64.length / 1024)} KB`,
					image: imageBase64,
				});
			} else {
				setScreenshotTest({
					status: "error",
					message:
						"No screenshot returned. Permission might be denied or no displays found.",
				});
			}
		} catch (error) {
			setScreenshotTest({
				status: "error",
				message: `Error: ${error}`,
			});
		}
	};

	const handleCaptureAndSave = async () => {
		setScreenshotTest({
			status: "loading",
			message: "Capturing and saving...",
		});
		try {
			await window.api.capture.trigger();
			setScreenshotTest({
				status: "success",
				message: "Screenshot captured and saved to Timeline!",
			});
		} catch (error) {
			setScreenshotTest({
				status: "error",
				message: `Error: ${error}`,
			});
		}
	};

	const handleStartScheduler = async () => {
		await window.api.scheduler.start(settings.captureInterval);
		setIsSchedulerRunning(true);
		setScreenshotTest({
			status: "success",
			message: `Auto-capture started! Interval: every ${settings.captureInterval} min`,
		});
	};

	const handleStopScheduler = async () => {
		await window.api.scheduler.stop();
		setIsSchedulerRunning(false);
		setScreenshotTest({ status: "idle" });
	};

	const handleIntervalChange = async (value: string) => {
		await updateSetting("captureInterval", parseInt(value, 10));
	};

	const handleRetentionChange = async (value: string) => {
		await updateSetting("retentionDays", parseInt(value, 10));
	};

	const tabTriggerClassName =
		"shrink-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-12 px-0";

	const handleRevealInFinder = async () => {
		if (!window.api) return;
		await window.api.app.revealInFinder();
	};

	const handleTestContextDetection = async () => {
		if (!window.api) return;
		setContextTest({ status: "loading" });
		try {
			const result = await window.api.context.test();
			setContextTest({
				status: result.success ? "success" : "error",
				result,
			});
		} catch (error) {
			const result: ContextTestResult = {
				success: false,
				appName: null,
				appBundleId: null,
				windowTitle: null,
				isFullscreen: false,
				urlHost: null,
				contentKind: null,
				contentId: null,
				contentTitle: null,
				contextKey: null,
				provider: null,
				confidence: null,
				error: String(error),
			};
			setContextTest({ status: "error", result });
		}
	};

	const handleRestartOnboarding = async () => {
		await saveSettings({
			...settings,
			onboarding: {
				...settings.onboarding,
				completedAt: null,
			},
		});
		window.location.reload();
	};

	return (
		<div className="h-full flex flex-col">
			<div className="drag-region flex flex-col border-b border-border p-2 px-4">
				<h1 className="text-lg font-semibold">Settings</h1>
				<p className="text-sm text-muted-foreground">
					Configure Screencap preferences
				</p>
			</div>

			<Tabs defaultValue="capture" className="flex-1 flex flex-col min-h-0">
				<div className="shrink-0 border-b border-border overflow-x-auto scrollbar-gutter-stable">
					<TabsList className="h-12 w-max bg-transparent px-4 gap-4 justify-start">
						<TabsTrigger value="capture" className={tabTriggerClassName}>
							<Camera className="h-4 w-4 mr-2" />
							Capture
						</TabsTrigger>
						<TabsTrigger value="ai" className={tabTriggerClassName}>
							<Bot className="h-4 w-4 mr-2" />
							AI
						</TabsTrigger>
						<TabsTrigger value="automation" className={tabTriggerClassName}>
							<Workflow className="h-4 w-4 mr-2" />
							Automation
						</TabsTrigger>
						<TabsTrigger value="data" className={tabTriggerClassName}>
							<Database className="h-4 w-4 mr-2" />
							Data
						</TabsTrigger>
						<TabsTrigger value="system" className={tabTriggerClassName}>
							<SlidersHorizontal className="h-4 w-4 mr-2" />
							System
						</TabsTrigger>
					</TabsList>
				</div>

				<ScrollArea className="flex-1">
					<TabsContent value="capture" className="p-6 m-0">
						<div className="space-y-6">
							<SettingsTabHeader
								title="Capture"
								description="Schedule screenshots and validate capture permissions"
							/>

							<Panel
								title="Schedule"
								meta="Automatic screenshot capture"
								right={
									<div className="flex items-center gap-2">
										<div className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-xs text-muted-foreground">
											<div
												className={`h-2 w-2 rounded-full ${
													isSchedulerRunning
														? "bg-accent"
														: "bg-muted-foreground"
												}`}
											/>
											<span className="text-foreground/90">
												{isSchedulerRunning ? "Running" : "Stopped"}
											</span>
										</div>
										{!isSchedulerRunning ? (
											<Button
												size="sm"
												variant="outline"
												className="border-accent/40 text-accent hover:bg-accent/10"
												onClick={handleStartScheduler}
											>
												<Play className="h-4 w-4 mr-2" />
												Start
											</Button>
										) : (
											<Button
												size="sm"
												variant="outline"
												className="border-destructive/40 text-destructive hover:bg-destructive/10"
												onClick={handleStopScheduler}
											>
												<Square className="h-4 w-4 mr-2" />
												Stop
											</Button>
										)}
									</div>
								}
							>
								<SettingsRows>
									<SettingsRow
										title="Capture interval"
										description="How often to capture screenshots (shorter intervals use more storage)"
										right={
											<Select
												value={String(settings.captureInterval)}
												onValueChange={handleIntervalChange}
											>
												<SelectTrigger className="h-8 w-full sm:w-[220px]">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="1">Every 1 minute</SelectItem>
													<SelectItem value="2">Every 2 minutes</SelectItem>
													<SelectItem value="5">Every 5 minutes</SelectItem>
													<SelectItem value="10">Every 10 minutes</SelectItem>
													<SelectItem value="15">Every 15 minutes</SelectItem>
													<SelectItem value="30">Every 30 minutes</SelectItem>
												</SelectContent>
											</Select>
										}
									/>
								</SettingsRows>
							</Panel>

							<Panel
								title="Manual capture"
								meta="Capture now or validate permissions"
							>
								<div className="space-y-3">
									<div className="grid gap-2 sm:grid-cols-2">
										<Button
											onClick={handleTestScreenshot}
											disabled={screenshotTest.status === "loading"}
											variant="outline"
										>
											{screenshotTest.status === "loading" ? (
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											) : (
												<Camera className="h-4 w-4 mr-2" />
											)}
											Test Only
										</Button>
										<Button
											onClick={handleCaptureAndSave}
											disabled={screenshotTest.status === "loading"}
										>
											{screenshotTest.status === "loading" ? (
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											) : (
												<Camera className="h-4 w-4 mr-2" />
											)}
											Capture & Save
										</Button>
									</div>

									{screenshotTest.status === "loading" && (
										<div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground">
											<Loader2 className="h-4 w-4 animate-spin" />
											<span className="text-sm">
												{screenshotTest.message || "Working..."}
											</span>
										</div>
									)}

									{screenshotTest.status === "success" && (
										<div className="space-y-2">
											<div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-500">
												<Check className="h-4 w-4" />
												<span className="text-sm">
													{screenshotTest.message}
												</span>
											</div>
											{screenshotTest.image ? (
												<div className="rounded-lg overflow-hidden border border-border">
													<img
														src={`data:image/webp;base64,${screenshotTest.image}`}
														alt="Screenshot preview"
														className="w-full"
													/>
												</div>
											) : null}
										</div>
									)}

									{screenshotTest.status === "error" && (
										<div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
											<AlertCircle className="h-4 w-4" />
											<span className="text-sm">{screenshotTest.message}</span>
										</div>
									)}
								</div>
							</Panel>
						</div>
					</TabsContent>

					<TabsContent value="ai" className="p-6 m-0">
						<div className="space-y-6">
							<SettingsTabHeader
								title="AI"
								description="Configure OpenRouter-based screenshot classification"
							/>

							<Panel
								title="Classification"
								meta="Categorize screenshots automatically"
							>
								<SettingsRows>
									<SettingsRow
										title="Enable AI classification"
										description="Send screenshots to OpenRouter for automatic categorization"
										right={
											<Switch
												checked={settings.llmEnabled}
												onCheckedChange={(checked) =>
													updateSetting("llmEnabled", checked)
												}
											/>
										}
									/>
								</SettingsRows>

								{settings.llmEnabled ? (
									<div className="mt-4 space-y-3">
										<div className="space-y-2">
											<div className="text-sm font-medium">
												OpenRouter API key
											</div>
											<div className="flex flex-col gap-2 sm:flex-row">
												<Input
													type="password"
													value={apiKey}
													onChange={(e) => setApiKey(e.target.value)}
													placeholder="sk-or-..."
													className="flex-1"
												/>
												<Button
													variant="outline"
													onClick={handleSaveApiKey}
													className="sm:w-[90px]"
												>
													Save
												</Button>
												<Button
													variant="secondary"
													onClick={handleTestConnection}
													disabled={!apiKey || isTesting}
													className="sm:w-[90px]"
												>
													{isTesting ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														"Test"
													)}
												</Button>
											</div>
											<p className="text-xs text-muted-foreground">
												Get your API key from{" "}
												<a
													href="https://openrouter.ai/keys"
													target="_blank"
													rel="noopener noreferrer"
													className="text-accent hover:underline"
												>
													openrouter.ai/keys
												</a>
											</p>
										</div>

										{testResult ? (
											<div
												className={`flex items-center gap-2 p-3 rounded-lg ${
													testResult.success
														? "bg-green-500/10 text-green-500"
														: "bg-destructive/10 text-destructive"
												}`}
											>
												{testResult.success ? (
													<>
														<Check className="h-4 w-4" />
														<span className="text-sm">
															Connection successful!
														</span>
													</>
												) : (
													<>
														<AlertCircle className="h-4 w-4" />
														<span className="text-sm">
															Connection failed:{" "}
															{testResult.error || "Unknown error"}
														</span>
													</>
												)}
											</div>
										) : null}
									</div>
								) : (
									<div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
										Screenshots are captured locally but not sent for AI
										classification.
									</div>
								)}
							</Panel>
						</div>
					</TabsContent>

					<TabsContent value="automation" className="p-6 m-0">
						<div className="space-y-6">
							<SettingsTabHeader
								title="Automation"
								description="Skip capture or AI processing for specific apps and websites"
							/>
							<AutomationRulesSection />
						</div>
					</TabsContent>

					<TabsContent value="data" className="p-6 m-0">
						<div className="space-y-6">
							<SettingsTabHeader
								title="Data"
								description="Control retention and review privacy guarantees"
							/>

							<Panel title="Storage" meta="Retention policy">
								<SettingsRows>
									<SettingsRow
										title="Storage location"
										description="Contains screenshots, database, and settings"
										right={
											<Button
												variant="outline"
												size="sm"
												onClick={handleRevealInFinder}
											>
												<FolderOpen className="h-4 w-4 mr-2" />
												Reveal in Finder
											</Button>
										}
									/>
									<SettingsRow
										title="Retention period"
										description="Screenshots older than this will be automatically deleted"
										right={
											<Select
												value={String(settings.retentionDays)}
												onValueChange={handleRetentionChange}
											>
												<SelectTrigger className="h-8 w-full sm:w-[220px]">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="7">7 days</SelectItem>
													<SelectItem value="14">14 days</SelectItem>
													<SelectItem value="30">30 days</SelectItem>
													<SelectItem value="60">60 days</SelectItem>
													<SelectItem value="90">90 days</SelectItem>
													<SelectItem value="365">1 year</SelectItem>
												</SelectContent>
											</Select>
										}
									/>
								</SettingsRows>
							</Panel>

							<Panel title="Privacy" meta="How Screencap handles your data">
								<div className="text-sm space-y-2">
									<p className="font-medium">Your data stays on your device</p>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Screenshots are stored locally in your app data folder
										</li>
										<li>API key is encrypted using macOS Keychain</li>
										<li>
											Only screenshot images are sent to OpenRouter for
											classification
										</li>
										<li>
											No data is shared with third parties beyond LLM
											classification
										</li>
									</ul>
								</div>
							</Panel>
						</div>
					</TabsContent>

					<TabsContent value="system" className="p-6 m-0">
						<div className="space-y-6">
							<SettingsTabHeader
								title="System"
								description="Permissions, diagnostics, updates, and app info"
							/>

							<Panel
								title="Permissions"
								meta="App context detection needs macOS permissions"
							>
								<div className="space-y-4">
									<p className="text-sm text-muted-foreground">
										Detect the foreground app, window title, and browser URLs to
										precisely identify what you're doing.
									</p>

									{contextStatus ? (
										<div className="grid gap-2 sm:grid-cols-2">
											<PermissionBadge
												status={contextStatus.screenCapture}
												label="Screen Recording"
											/>
											<PermissionBadge
												status={contextStatus.accessibility}
												label="Accessibility"
											/>
											<PermissionBadge
												status={contextStatus.automation.systemEvents}
												label="Automation (System Events)"
											/>
											<PermissionBadge
												status={contextStatus.automation.browsers}
												label="Automation (Browsers)"
											/>
											<PermissionBadge
												status={contextStatus.automation.apps}
												label="Automation (Apps)"
											/>
										</div>
									) : (
										<div className="text-sm text-muted-foreground">
											Loading permission status...
										</div>
									)}

									<div className="flex flex-col gap-2 sm:flex-row">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												window.api.permissions.openAccessibilitySettings()
											}
										>
											<ExternalLink className="h-4 w-4 mr-2" />
											Accessibility
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												window.api.permissions.openAutomationSettings()
											}
										>
											<ExternalLink className="h-4 w-4 mr-2" />
											Automation
										</Button>
									</div>
								</div>
							</Panel>

							<Panel title="Diagnostics" meta="Validate app context detection">
								<div className="space-y-3">
									<Button
										variant="secondary"
										onClick={handleTestContextDetection}
										disabled={contextTest.status === "loading"}
									>
										{contextTest.status === "loading" ? (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										) : (
											<Eye className="h-4 w-4 mr-2" />
										)}
										Test Context Detection
									</Button>

									{contextTest.status === "success" && contextTest.result ? (
										<div className="p-3 rounded-lg bg-green-500/10 text-green-500 text-sm space-y-1">
											<div className="flex items-center gap-2">
												<Check className="h-4 w-4" />
												<span className="font-medium">Context detected</span>
											</div>
											<div className="text-xs text-muted-foreground space-y-0.5 mt-2">
												<p>
													<strong>App:</strong> {contextTest.result.appName} (
													{contextTest.result.appBundleId})
												</p>
												<p>
													<strong>Window:</strong>{" "}
													{contextTest.result.windowTitle || "(none)"}
												</p>
												<p>
													<strong>Fullscreen:</strong>{" "}
													{contextTest.result.isFullscreen ? "Yes" : "No"}
												</p>
												{contextTest.result.urlHost ? (
													<p>
														<strong>Host:</strong> {contextTest.result.urlHost}
													</p>
												) : null}
												{contextTest.result.contentKind ? (
													<p>
														<strong>Content:</strong>{" "}
														{contextTest.result.contentKind} /{" "}
														{contextTest.result.contentId}
													</p>
												) : null}
												<p>
													<strong>Key:</strong>{" "}
													<code className="text-xs">
														{contextTest.result.contextKey}
													</code>
												</p>
												<p>
													<strong>Provider:</strong>{" "}
													{contextTest.result.provider} (confidence:{" "}
													{((contextTest.result.confidence ?? 0) * 100).toFixed(
														0,
													)}
													%)
												</p>
											</div>
										</div>
									) : null}

									{contextTest.status === "error" ? (
										<div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
											<AlertCircle className="h-4 w-4" />
											<span className="text-sm">
												{contextTest.result?.error ||
													"Failed to detect context"}
											</span>
										</div>
									) : null}
								</div>
							</Panel>

							<Panel title="Updates" meta="Keep Screencap up to date">
								<div className="space-y-3">
									<div className="flex items-center gap-2">
										{updateState?.status === "checking" ? (
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<Loader2 className="h-4 w-4 animate-spin" />
												Checking for updates...
											</div>
										) : null}
										{updateState?.status === "not_available" ? (
											<div className="flex items-center gap-2 text-sm text-green-500">
												<Check className="h-4 w-4" />
												You're up to date
											</div>
										) : null}
										{updateState?.status === "available" ? (
											<div className="flex items-center gap-2 text-sm text-blue-500">
												<Download className="h-4 w-4" />
												Update available: v{updateState.availableVersion}
											</div>
										) : null}
										{updateState?.status === "downloading" ? (
											<div className="flex-1 space-y-1">
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Loader2 className="h-4 w-4 animate-spin" />
													Downloading update...
												</div>
												{updateState.progress ? (
													<div className="w-full bg-muted rounded-full h-2">
														<div
															className="bg-primary h-2 rounded-full transition-all"
															style={{
																width: `${updateState.progress.percent}%`,
															}}
														/>
													</div>
												) : null}
											</div>
										) : null}
										{updateState?.status === "downloaded" ? (
											<div className="flex items-center gap-2 text-sm text-green-500">
												<Check className="h-4 w-4" />
												Update ready to install
											</div>
										) : null}
										{updateState?.status === "error" ? (
											<div className="flex items-center gap-2 text-sm text-destructive">
												<AlertCircle className="h-4 w-4" />
												{updateState.error?.message || "Update failed"}
											</div>
										) : null}
										{!updateState ? (
											<div className="text-sm text-muted-foreground">
												Loading update status...
											</div>
										) : null}
									</div>

									<div className="flex flex-col gap-2 sm:flex-row">
										{updateState?.status === "downloaded" ? (
											<Button
												onClick={() => window.api.update.restartAndInstall()}
											>
												<RotateCcw className="h-4 w-4 mr-2" />
												Restart to Update
											</Button>
										) : updateState?.status === "available" ? (
											<Button onClick={() => window.api.update.download()}>
												<Download className="h-4 w-4 mr-2" />
												Download Update
											</Button>
										) : (
											<Button
												variant="outline"
												onClick={() => window.api.update.check()}
												disabled={
													updateState?.status === "checking" ||
													updateState?.status === "downloading"
												}
											>
												<RefreshCw
													className={`h-4 w-4 mr-2 ${updateState?.status === "checking" ? "animate-spin" : ""}`}
												/>
												Check for Updates
											</Button>
										)}
									</div>

									{updateState?.lastCheckedAt &&
									updateState.status !== "checking" ? (
										<p className="text-xs text-muted-foreground">
											Last checked:{" "}
											{new Date(updateState.lastCheckedAt).toLocaleString()}
										</p>
									) : null}
								</div>
							</Panel>

							<Panel
								title="About"
								meta="Version and runtime info"
								right={
									appInfo ? (
										<Badge
											variant="secondary"
											className="border-0 bg-muted text-muted-foreground"
										>
											v{appInfo.version}
										</Badge>
									) : null
								}
							>
								{appInfo ? (
									<div className="space-y-3">
										<div className="text-2xl font-semibold">{appInfo.name}</div>
										<p className="text-sm text-muted-foreground">
											Screen activity tracker with LLM-powered classification.
										</p>

										{appInfo.buildDate || appInfo.gitSha ? (
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												{appInfo.buildDate ? (
													<span>Built: {appInfo.buildDate}</span>
												) : null}
												{appInfo.gitSha ? (
													<button
														type="button"
														className="font-mono hover:text-foreground flex items-center gap-1"
														onClick={() =>
															navigator.clipboard.writeText(appInfo.gitSha!)
														}
													>
														<Copy className="h-3 w-3" />
														{appInfo.gitSha.slice(0, 7)}
													</button>
												) : null}
											</div>
										) : null}

										<div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
											<p>
												Electron {appInfo.electron} · Chrome {appInfo.chrome} ·
												Node {appInfo.node}
											</p>
											<p>
												{appInfo.platform} {appInfo.arch} · macOS{" "}
												{appInfo.osVersion}
											</p>
										</div>
									</div>
								) : (
									<div className="text-sm text-muted-foreground">
										Loading...
									</div>
								)}
							</Panel>

							<Panel title="Onboarding" meta="Re-run the setup wizard">
								<div className="space-y-2">
									<Button variant="outline" onClick={handleRestartOnboarding}>
										<RotateCcw className="h-4 w-4 mr-2" />
										Restart Onboarding
									</Button>
									<p className="text-xs text-muted-foreground">
										Re-run the initial setup wizard to configure permissions and
										preferences.
									</p>
								</div>
							</Panel>
						</div>
					</TabsContent>
				</ScrollArea>
			</Tabs>
		</div>
	);
}
