import { motion } from "framer-motion";
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Check,
	ExternalLink,
	Eye,
	Loader2,
	Lock,
	Monitor,
	RefreshCw,
	Shield,
	Sparkles,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AsciiLogo } from "@/components/onboarding/AsciiLogo";
import { MatrixBorder } from "@/components/onboarding/MatrixBorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import type { AppInfo, LLMTestResult } from "@/types";

const ease = [0.25, 0.1, 0.25, 1] as const;

function FadeIn({
	children,
	delay = 0,
	className = "",
	variant = "step",
}: {
	children: React.ReactNode;
	delay?: number;
	className?: string;
	variant?: "intro" | "step";
}) {
	if (variant === "step") {
		return <div className={className}>{children}</div>;
	}

	const preset =
		variant === "intro"
			? { duration: 0.28, blurPx: 5, yPx: 8 }
			: { duration: 0.08, blurPx: 0, yPx: 2 };

	return (
		<motion.div
			initial={{
				opacity: 0,
				filter: `blur(${preset.blurPx}px)`,
				y: preset.yPx,
			}}
			animate={{
				opacity: 1,
				filter: "blur(0px)",
				y: 0,
			}}
			exit={{
				opacity: 0,
				filter: `blur(${preset.blurPx}px)`,
				y: -preset.yPx,
			}}
			transition={{ duration: preset.duration, ease, delay }}
			className={className}
		>
			{children}
		</motion.div>
	);
}

function PrimaryButton({
	children,
	onClick,
	disabled,
	className = "",
}: {
	children: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<motion.button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
				"border-zinc-800 bg-black/90 text-zinc-200 hover:bg-zinc-950/60 hover:border-yellow-500/40 hover:text-white",
				"disabled:opacity-50 disabled:pointer-events-none",
				className,
			)}
			whileHover={{
				textShadow:
					"0 0 10px rgba(255, 215, 0, 0.55), 0 0 18px rgba(255, 215, 0, 0.25)",
				boxShadow:
					"0 0 0 1px rgba(255, 215, 0, 0.06), 0 0 18px rgba(255, 215, 0, 0.10)",
			}}
			whileTap={{ scale: 0.99 }}
			transition={{ duration: 0.18 }}
		>
			{children}
		</motion.button>
	);
}

function BackButton({
	onClick,
	className = "",
}: {
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors",
				"border-zinc-800/50 bg-transparent text-zinc-400 hover:text-white hover:border-zinc-700",
				className,
			)}
		>
			<ArrowLeft className="h-3.5 w-3.5" />
			Back
		</button>
	);
}

function BottomActions({
	left,
	right,
}: {
	left: React.ReactNode;
	right: React.ReactNode;
}) {
	return (
		<div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
			<div className="pointer-events-auto flex items-center justify-center gap-2">
				{left}
				{right}
			</div>
		</div>
	);
}

type OnboardingStep =
	| "welcome"
	| "screen-recording"
	| "accessibility"
	| "automation"
	| "ai-choice"
	| "privacy"
	| "finish";

const STEPS: OnboardingStep[] = [
	"welcome",
	"screen-recording",
	"accessibility",
	"automation",
	"ai-choice",
	"privacy",
	"finish",
];

interface OnboardingWizardProps {
	onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
	const [step, setStep] = useState<OnboardingStep>("welcome");
	const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
	const { settings, updateSetting, saveSettings } = useSettings();
	const status = useOnboardingStatus(1500);

	useEffect(() => {
		window.api?.app.getInfo().then(setAppInfo);
	}, []);

	const currentIndex = STEPS.indexOf(step);

	const goNext = useCallback(() => {
		const nextIndex = currentIndex + 1;
		if (nextIndex < STEPS.length) {
			setStep(STEPS[nextIndex]);
		}
	}, [currentIndex]);

	const goBack = useCallback(() => {
		const prevIndex = currentIndex - 1;
		if (prevIndex >= 0) {
			setStep(STEPS[prevIndex]);
		}
	}, [currentIndex]);

	const handleComplete = useCallback(async () => {
		await saveSettings({
			...settings,
			onboarding: {
				version: settings.onboarding.version,
				completedAt: Date.now(),
			},
		});
		onComplete();
	}, [settings, saveSettings, onComplete]);

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background">
			<div className="h-10 drag-region shrink-0" />
			<div className="flex-1 flex flex-col overflow-hidden">
				<ProgressBar
					current={currentIndex}
					className="h-0 overflow-hidden px-0 pt-0 pb-0 opacity-0 pointer-events-none"
				/>
				<ScrollArea className="flex-1">
					<div className="relative max-w-2xl mx-auto px-6 py-8">
						{step === "welcome" && <WelcomeStep onNext={goNext} />}
						{step === "screen-recording" && (
							<ScreenRecordingStep
								status={status.screenCaptureStatus}
								isPackaged={appInfo?.isPackaged ?? false}
								onNext={goNext}
								onRefresh={status.refresh}
								onBack={goBack}
							/>
						)}
						{step === "accessibility" && (
							<AccessibilityStep
								status={status.accessibilityStatus}
								onNext={goNext}
								onSkip={goNext}
								onRefresh={status.refresh}
								onBack={goBack}
							/>
						)}
						{step === "automation" && (
							<AutomationStep
								automationStatus={status.automationStatus}
								onNext={goNext}
								onRefresh={status.refresh}
								onBack={goBack}
							/>
						)}
						{step === "ai-choice" && (
							<AIChoiceStep
								apiKey={settings.apiKey}
								llmEnabled={settings.llmEnabled}
								onApiKeyChange={(key) => updateSetting("apiKey", key)}
								onLlmEnabledChange={(enabled) =>
									updateSetting("llmEnabled", enabled)
								}
								onNext={goNext}
								onBack={goBack}
							/>
						)}
						{step === "privacy" && (
							<PrivacyStep onNext={goNext} onBack={goBack} />
						)}
						{step === "finish" && (
							<FinishStep
								status={status}
								llmEnabled={settings.llmEnabled}
								onComplete={handleComplete}
								onBack={goBack}
							/>
						)}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}

function ProgressBar({
	current,
	className,
}: {
	current: number;
	className?: string;
}) {
	return (
		<div className={cn(className)}>
			<div className="max-w-2xl mx-auto">
				<div className="flex gap-1">
					{STEPS.map((stepName, idx) => (
						<div
							key={stepName}
							className={cn(
								"h-1 flex-1 rounded-full transition-colors",
								idx <= current ? "bg-primary" : "bg-muted",
							)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
	const [ctaActive, setCtaActive] = useState(false);

	return (
		<motion.div
			className="space-y-6 pt-16"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.18, ease }}
		>
			<FadeIn delay={0} variant="intro">
				<AsciiLogo />
			</FadeIn>

			<FadeIn delay={0.05} className="text-center" variant="intro">
				<p className="text-sm text-muted-foreground text-center -mt-16 mb-10 max-w-md mx-auto">
					What did I do today? Yesterday? How long do I actually work? Am I
					addicted to bullet chess? Screencap to understand your time.
				</p>
			</FadeIn>
			{/* 
			<FadeIn delay={0.12} className="grid grid-cols-3 gap-3 text-center" variant="intro">
				<div className="p-3 rounded-lg bg-muted/30">
					<Monitor className="h-4 w-4 mx-auto mb-1.5 text-primary" />
					<p className="text-xs font-medium">Local Storage</p>
					<p className="text-[10px] text-muted-foreground mt-0.5">
						Your data stays on device
					</p>
				</div>
				<div className="p-3 rounded-lg bg-muted/30">
					<Lock className="h-4 w-4 mx-auto mb-1.5 text-primary" />
					<p className="text-xs font-medium">Privacy First</p>
					<p className="text-[10px] text-muted-foreground mt-0.5">
						AI is opt-in only
					</p>
				</div>
				<div className="p-3 rounded-lg bg-muted/30">
					<Sparkles className="h-4 w-4 mx-auto mb-1.5 text-primary" />
					<p className="text-xs font-medium">Smart Insights</p>
					<p className="text-[10px] text-muted-foreground mt-0.5">
						Auto-categorize activities
					</p>
				</div>
			</FadeIn> */}

			<FadeIn delay={0.22} variant="intro">
				<div className="flex justify-center">
					<MatrixBorder active={ctaActive} className="w-[280px]">
						<button
							type="button"
							onClick={onNext}
							onMouseEnter={() => setCtaActive(true)}
							onMouseLeave={() => setCtaActive(false)}
							onFocus={() => setCtaActive(true)}
							onBlur={() => setCtaActive(false)}
							className={cn(
								"relative z-10 w-full flex items-center justify-center px-6 py-3.5",
								"bg-transparent text-zinc-400 transition-colors hover:text-zinc-100",
							)}
						>
							<span className="text-sm font-medium">Get started</span>
						</button>
					</MatrixBorder>
				</div>
			</FadeIn>
		</motion.div>
	);
}

function ScreenRecordingStep({
	status,
	isPackaged,
	onNext,
	onRefresh,
	onBack,
}: {
	status: "granted" | "denied" | "not-determined";
	isPackaged: boolean;
	onNext: () => void;
	onRefresh: () => void;
	onBack: () => void;
}) {
	const [isChecking, setIsChecking] = useState(false);

	const handleOpenSettings = () => {
		window.api?.permissions.openSettings();
	};

	const handleCheckAgain = async () => {
		setIsChecking(true);
		await onRefresh();
		setTimeout(() => setIsChecking(false), 500);
	};

	const isGranted = status === "granted";
	const appName = isPackaged ? "Screencap" : "Electron";

	return (
		<div className="space-y-8 pb-24">
			<FadeIn delay={0}>
				<div className="space-y-4">
					<PermissionHeader
						icon={<Monitor className="h-6 w-6" />}
						title="Screen Recording"
						required
					/>
					<p className="text-muted-foreground">
						Screencap needs permission to capture screenshots of your screen.
						This is the core feature that enables activity tracking.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.02}>
				<PermissionStatusBadge status={status} />
			</FadeIn>

			<FadeIn delay={0.04} className="space-y-4">
				<h3 className="font-medium">What we access</h3>
				<ul className="text-sm text-muted-foreground space-y-2">
					<li className="flex items-start gap-2">
						<Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
						Screenshots of your displays at the interval you choose
					</li>
					<li className="flex items-start gap-2">
						<Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
						Stored locally in WebP format with automatic retention cleanup
					</li>
				</ul>

				<h3 className="font-medium">What we do NOT do</h3>
				<ul className="text-sm text-muted-foreground space-y-2">
					<li className="flex items-start gap-2">
						<X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
						Share screenshots without your explicit choice (AI is opt-in)
					</li>
					<li className="flex items-start gap-2">
						<X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
						Capture when system is idle for 5+ minutes
					</li>
				</ul>
			</FadeIn>

			{!isGranted && (
				<FadeIn delay={0.06}>
					<div className="flex gap-3 mb-6">
						<PrimaryButton onClick={handleOpenSettings} className="flex-1">
							<ExternalLink className="h-4 w-4" />
							Open System Settings
						</PrimaryButton>
						<Button
							variant="outline"
							onClick={handleCheckAgain}
							disabled={isChecking}
						>
							{isChecking ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="h-4 w-4" />
							)}
							Check Again
						</Button>
					</div>

					<TroubleshootingCard>
						<ul className="text-sm space-y-2">
							<li>
								Look for <strong>{appName}</strong> in Privacy & Security →
								Screen Recording
							</li>
							<li>
								If already listed: toggle it <strong>OFF then ON</strong>
							</li>
							<li>
								After granting, you may need to <strong>quit and reopen</strong>{" "}
								the app
							</li>
						</ul>
					</TroubleshootingCard>
				</FadeIn>
			)}

			<BottomActions
				left={<BackButton onClick={onBack} />}
				right={
					<PrimaryButton
						onClick={onNext}
						className="h-9 px-4"
						disabled={!isGranted}
					>
						Continue
						<ArrowRight className="h-4 w-4" />
					</PrimaryButton>
				}
			/>
		</div>
	);
}

function AccessibilityStep({
	status,
	onNext,
	onSkip,
	onRefresh,
	onBack,
}: {
	status: "granted" | "denied" | "not-determined";
	onNext: () => void;
	onSkip: () => void;
	onRefresh: () => void;
	onBack: () => void;
}) {
	const [isRequesting, setIsRequesting] = useState(false);

	const handleRequest = async () => {
		setIsRequesting(true);
		await window.api?.permissions.requestAccessibility();
		setTimeout(() => {
			onRefresh();
			setIsRequesting(false);
		}, 1000);
	};

	const handleOpenSettings = () => {
		window.api?.permissions.openAccessibilitySettings();
	};

	const isGranted = status === "granted";

	return (
		<div className="space-y-8 pb-24">
			<FadeIn delay={0}>
				<div className="space-y-4">
					<PermissionHeader
						icon={<Eye className="h-6 w-6" />}
						title="Accessibility"
						recommended
					/>
					<p className="text-muted-foreground">
						Accessibility access allows Screencap to detect which app and window
						is in the foreground, providing better context for your activity.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.02}>
				<PermissionStatusBadge status={status} />
			</FadeIn>

			<FadeIn delay={0.04} className="space-y-4">
				<h3 className="font-medium">What we access</h3>
				<ul className="text-sm text-muted-foreground space-y-2">
					<li className="flex items-start gap-2">
						<Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
						Foreground app name and bundle ID
					</li>
					<li className="flex items-start gap-2">
						<Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
						Active window title
					</li>
				</ul>
			</FadeIn>

			<FadeIn delay={0.05}>
				<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
					<p className="text-sm text-amber-600 dark:text-amber-400">
						<strong>If you skip:</strong> Screenshots will still be captured,
						but without app/window context. Classification will rely solely on
						image analysis.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.06}>
				{!isGranted && (
					<div className="flex gap-3 mb-6">
						<PrimaryButton
							onClick={handleRequest}
							className="flex-1"
							disabled={isRequesting}
						>
							{isRequesting ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Shield className="h-4 w-4" />
							)}
							Request Permission
						</PrimaryButton>
						<Button variant="outline" onClick={handleOpenSettings}>
							<ExternalLink className="h-4 w-4" />
							Settings
						</Button>
					</div>
				)}
			</FadeIn>

			<BottomActions
				left={<BackButton onClick={onBack} />}
				right={
					<PrimaryButton
						onClick={isGranted ? onNext : onSkip}
						className="h-9 px-4"
					>
						Continue
						<ArrowRight className="h-4 w-4" />
					</PrimaryButton>
				}
			/>
		</div>
	);
}

function AutomationStep({
	automationStatus,
	onNext,
	onRefresh,
	onBack,
}: {
	automationStatus: {
		systemEvents: "granted" | "denied" | "not-determined";
		browsers: "granted" | "denied" | "not-determined";
		apps: "granted" | "denied" | "not-determined";
	};
	onNext: () => void;
	onRefresh: () => void;
	onBack: () => void;
}) {
	const [isTesting, setIsTesting] = useState(false);

	const handleTest = async () => {
		setIsTesting(true);
		await window.api?.context.test();
		setTimeout(() => {
			onRefresh();
			setIsTesting(false);
		}, 1000);
	};

	const handleOpenSettings = () => {
		window.api?.permissions.openAutomationSettings();
	};

	return (
		<div className="space-y-8 pb-24">
			<FadeIn delay={0}>
				<div className="space-y-4">
					<PermissionHeader
						icon={<Zap className="h-6 w-6" />}
						title="Automation"
						optional
					/>
					<p className="text-muted-foreground">
						Automation permissions enable Screencap to read URLs from browsers
						and content info from apps like Spotify. macOS prompts for each app
						separately.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.02} className="space-y-3">
				<AutomationItem
					label="System Events"
					description="Foreground app/window detection"
					status={automationStatus.systemEvents}
				/>
				<AutomationItem
					label="Browsers"
					description="Safari, Chrome, Brave, Edge URL extraction"
					status={automationStatus.browsers}
				/>
				<AutomationItem
					label="Apps"
					description="Spotify track info and similar"
					status={automationStatus.apps}
				/>
			</FadeIn>

			<FadeIn delay={0.04}>
				<div className="bg-muted/50 rounded-lg p-4 space-y-2">
					<p className="text-sm">
						<strong>How permissions work:</strong> macOS will prompt you the
						first time Screencap tries to access each app. Click "Test Context
						Detection" to trigger these prompts while using your browser or
						Spotify.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.06}>
				<div className="flex gap-3 mb-6">
					<Button
						onClick={handleTest}
						variant="secondary"
						className="flex-1"
						disabled={isTesting}
					>
						{isTesting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Eye className="h-4 w-4" />
						)}
						Test Context Detection
					</Button>
					<Button variant="outline" onClick={handleOpenSettings}>
						<ExternalLink className="h-4 w-4" />
						Settings
					</Button>
				</div>
			</FadeIn>

			<BottomActions
				left={<BackButton onClick={onBack} />}
				right={
					<PrimaryButton onClick={onNext} className="h-9 px-4">
						Continue
						<ArrowRight className="h-4 w-4" />
					</PrimaryButton>
				}
			/>
		</div>
	);
}

function AIChoiceStep({
	apiKey,
	llmEnabled,
	onApiKeyChange,
	onLlmEnabledChange,
	onNext,
	onBack,
}: {
	apiKey: string | null;
	llmEnabled: boolean;
	onApiKeyChange: (key: string | null) => void;
	onLlmEnabledChange: (enabled: boolean) => void;
	onNext: () => void;
	onBack: () => void;
}) {
	const [localKey, setLocalKey] = useState(apiKey || "");
	const [testResult, setTestResult] = useState<LLMTestResult | null>(null);
	const [isTesting, setIsTesting] = useState(false);

	const handleEnableAI = () => {
		onLlmEnabledChange(true);
	};

	const handleDisableAI = () => {
		onLlmEnabledChange(false);
		onApiKeyChange(null);
	};

	const handleSaveAndTest = async () => {
		if (!localKey.trim()) return;
		onApiKeyChange(localKey);
		setIsTesting(true);
		setTestResult(null);
		try {
			const result = await window.api?.llm.testConnection();
			setTestResult(result ?? { success: false, error: "No response" });
		} catch (error) {
			setTestResult({ success: false, error: String(error) });
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<div className="space-y-8">
			<FadeIn delay={0}>
				<div className="space-y-4">
					<PermissionHeader
						icon={<Sparkles className="h-6 w-6" />}
						title="AI Classification"
					/>
					<p className="text-muted-foreground">
						Optionally enable AI to automatically categorize your activities.
						Screenshots are sent to OpenRouter for analysis.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.02} className="grid gap-4">
				<button
					type="button"
					onClick={handleEnableAI}
					className={cn(
						"p-4 rounded-lg border text-left transition-all",
						llmEnabled
							? "border-primary bg-primary/5"
							: "border-border hover:border-muted-foreground/50",
					)}
				>
					<div className="flex items-start gap-3">
						<div
							className={cn(
								"p-2 rounded-lg",
								llmEnabled ? "bg-primary/20" : "bg-muted",
							)}
						>
							<Sparkles
								className={cn(
									"h-5 w-5",
									llmEnabled ? "text-primary" : "text-muted-foreground",
								)}
							/>
						</div>
						<div className="flex-1">
							<p className="font-medium">Enable AI classification</p>
							<p className="text-sm text-muted-foreground mt-1">
								Screenshots are analyzed by AI to categorize activities
								automatically. Requires an OpenRouter API key.
							</p>
						</div>
						{llmEnabled && <Check className="h-5 w-5 text-primary shrink-0" />}
					</div>
				</button>

				<button
					type="button"
					onClick={handleDisableAI}
					className={cn(
						"p-4 rounded-lg border text-left transition-all",
						!llmEnabled
							? "border-primary bg-primary/5"
							: "border-border hover:border-muted-foreground/50",
					)}
				>
					<div className="flex items-start gap-3">
						<div
							className={cn(
								"p-2 rounded-lg",
								!llmEnabled ? "bg-primary/20" : "bg-muted",
							)}
						>
							<Lock
								className={cn(
									"h-5 w-5",
									!llmEnabled ? "text-primary" : "text-muted-foreground",
								)}
							/>
						</div>
						<div className="flex-1">
							<p className="font-medium">Keep everything local</p>
							<p className="text-sm text-muted-foreground mt-1">
								No data leaves your device. Events are captured but not
								automatically categorized.
							</p>
						</div>
						{!llmEnabled && <Check className="h-5 w-5 text-primary shrink-0" />}
					</div>
				</button>
			</FadeIn>

			{llmEnabled && (
				<FadeIn delay={0.04}>
					<div className="space-y-4 p-4 rounded-lg bg-muted/50">
						<div className="space-y-2">
							<label className="text-sm font-medium">OpenRouter API Key</label>
							<div className="flex gap-2">
								<Input
									type="password"
									value={localKey}
									onChange={(e) => setLocalKey(e.target.value)}
									placeholder="sk-or-..."
									className="flex-1"
								/>
								<Button
									onClick={handleSaveAndTest}
									disabled={!localKey.trim() || isTesting}
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
									onClick={(e) => {
										e.preventDefault();
										window.api?.app.openExternal("https://openrouter.ai/keys");
									}}
									className="text-primary hover:underline"
								>
									openrouter.ai/keys
								</a>
							</p>
						</div>

						{testResult && (
							<div
								className={cn(
									"flex items-center gap-2 p-3 rounded-lg text-sm",
									testResult.success
										? "bg-green-500/10 text-green-600 dark:text-green-400"
										: "bg-destructive/10 text-destructive",
								)}
							>
								{testResult.success ? (
									<>
										<Check className="h-4 w-4" />
										Connection successful!
									</>
								) : (
									<>
										<AlertCircle className="h-4 w-4" />
										{testResult.error || "Connection failed"}
									</>
								)}
							</div>
						)}

						<div className="text-sm text-muted-foreground space-y-1">
							<p>
								<strong>What is sent:</strong>
							</p>
							<ul className="list-disc list-inside space-y-0.5">
								<li>Screenshot image (WebP, ~100KB)</li>
								<li>App name and window title (if available)</li>
							</ul>
						</div>
					</div>
				</FadeIn>
			)}

			<BottomActions
				left={<BackButton onClick={onBack} />}
				right={
					<PrimaryButton onClick={onNext} className="h-9 px-4">
						Continue
						<ArrowRight className="h-4 w-4" />
					</PrimaryButton>
				}
			/>
		</div>
	);
}

function PrivacyStep({
	onNext,
	onBack,
}: {
	onNext: () => void;
	onBack: () => void;
}) {
	return (
		<div className="space-y-8 pb-24">
			<FadeIn delay={0}>
				<div className="space-y-4">
					<PermissionHeader
						icon={<Shield className="h-6 w-6" />}
						title="Privacy Controls"
					/>
					<p className="text-muted-foreground">
						Screencap gives you fine-grained control over what gets captured and
						analyzed. You can configure these anytime in Settings.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.02} className="space-y-4">
				<InfoCard
					icon={<Eye className="h-5 w-5" />}
					title="Skip capture for apps/sites"
					description="Prevent screenshots entirely when specific apps or websites are in focus. No image is captured."
				/>
				<InfoCard
					icon={<Sparkles className="h-5 w-5" />}
					title="Skip AI for apps/sites"
					description="Capture screenshots locally but don't send to AI. Useful for sensitive work apps."
				/>
				<InfoCard
					icon={<Lock className="h-5 w-5" />}
					title="Automatic idle detection"
					description="Capture is automatically skipped when your system is idle for 5+ minutes."
				/>
			</FadeIn>

			<FadeIn delay={0.04}>
				<div className="bg-muted/50 rounded-lg p-4">
					<p className="text-sm text-muted-foreground">
						<strong>Tip:</strong> Use the Automation Rules in Settings to create
						rules for specific apps (by bundle ID) or websites (by domain).
					</p>
				</div>
			</FadeIn>

			<BottomActions
				left={<BackButton onClick={onBack} />}
				right={
					<PrimaryButton onClick={onNext} className="h-9 px-4">
						Continue
						<ArrowRight className="h-4 w-4" />
					</PrimaryButton>
				}
			/>
		</div>
	);
}

function FinishStep({
	status,
	llmEnabled,
	onComplete,
	onBack,
}: {
	status: ReturnType<typeof useOnboardingStatus>;
	llmEnabled: boolean;
	onComplete: () => void;
	onBack: () => void;
}) {
	const [isStarting, setIsStarting] = useState(false);

	const handleComplete = async () => {
		setIsStarting(true);
		if (status.canCapture) {
			await window.api?.scheduler.start();
		}
		onComplete();
	};

	return (
		<div className="space-y-8 pb-24">
			<FadeIn delay={0}>
				<div className="text-center space-y-4">
					<div className="inline-flex p-4 rounded-2xl bg-green-500/10">
						<Check className="h-12 w-12 text-green-500" />
					</div>
					<h1 className="text-3xl font-bold">You're all set!</h1>
					<p className="text-lg text-muted-foreground">
						Screencap is ready to start tracking your activity.
					</p>
				</div>
			</FadeIn>

			<FadeIn delay={0.02} className="space-y-3">
				<h3 className="font-medium">Setup summary</h3>
				<SummaryItem
					label="Screen Recording"
					status={status.screenCaptureStatus}
					required
				/>
				<SummaryItem
					label="Accessibility"
					status={status.accessibilityStatus}
				/>
				<SummaryItem
					label="System Events"
					status={status.automationStatus.systemEvents}
				/>
				<SummaryItem
					label="Browser URLs"
					status={status.automationStatus.browsers}
				/>
				<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
					<span className="text-sm">AI Classification</span>
					<span
						className={cn(
							"text-xs px-2 py-1 rounded-full",
							llmEnabled
								? "bg-green-500/20 text-green-600 dark:text-green-400"
								: "bg-muted text-muted-foreground",
						)}
					>
						{llmEnabled ? "Enabled" : "Disabled"}
					</span>
				</div>
			</FadeIn>

			{!status.canCapture && (
				<FadeIn delay={0.04}>
					<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
						<div className="flex items-start gap-2">
							<AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
							<div>
								<p className="font-medium text-destructive">
									Screen Recording required
								</p>
								<p className="text-sm text-destructive/80 mt-1">
									Go back and grant Screen Recording permission to start
									capturing.
								</p>
							</div>
						</div>
					</div>
				</FadeIn>
			)}

			<BottomActions
				left={<BackButton onClick={onBack} />}
				right={
					<PrimaryButton
						onClick={handleComplete}
						className="h-9 px-4"
						disabled={isStarting}
					>
						{isStarting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<>
								{status.canCapture ? "Start Screencap" : "Finish Setup"}
								<ArrowRight className="h-4 w-4" />
							</>
						)}
					</PrimaryButton>
				}
			/>
		</div>
	);
}

function InfoCard({
	icon,
	title,
	description,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
}) {
	return (
		<div className="flex gap-4 p-4 rounded-lg bg-muted/50">
			<div className="shrink-0 p-2 rounded-lg bg-primary/10 text-primary h-fit">
				{icon}
			</div>
			<div>
				<p className="font-medium">{title}</p>
				<p className="text-sm text-muted-foreground mt-1">{description}</p>
			</div>
		</div>
	);
}

function PermissionHeader({
	icon,
	title,
	required,
	recommended,
	optional,
}: {
	icon: React.ReactNode;
	title: string;
	required?: boolean;
	recommended?: boolean;
	optional?: boolean;
}) {
	return (
		<div className="flex items-center gap-4">
			<div className="p-3 rounded-xl bg-primary/10 text-primary">{icon}</div>
			<div>
				<h1 className="text-2xl font-bold">{title}</h1>
				{required && (
					<span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
						Required
					</span>
				)}
				{recommended && (
					<span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
						Recommended
					</span>
				)}
				{optional && (
					<span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
						Optional
					</span>
				)}
			</div>
		</div>
	);
}

function PermissionStatusBadge({
	status,
}: {
	status: "granted" | "denied" | "not-determined";
}) {
	const config = {
		granted: {
			bg: "bg-green-500/10 border-green-500/20",
			text: "text-green-600 dark:text-green-400",
			icon: <Check className="h-5 w-5" />,
			label: "Permission granted",
		},
		denied: {
			bg: "bg-red-500/10 border-red-500/20",
			text: "text-red-600 dark:text-red-400",
			icon: <X className="h-5 w-5" />,
			label: "Permission denied",
		},
		"not-determined": {
			bg: "bg-amber-500/10 border-amber-500/20",
			text: "text-amber-600 dark:text-amber-400",
			icon: <AlertCircle className="h-5 w-5" />,
			label: "Permission not yet requested",
		},
	};

	const { bg, text, icon, label } = config[status];

	return (
		<div
			className={cn("flex items-center gap-3 p-4 rounded-lg border", bg, text)}
		>
			{icon}
			<span className="font-medium">{label}</span>
		</div>
	);
}

function TroubleshootingCard({ children }: { children: React.ReactNode }) {
	return (
		<div className="bg-muted/50 rounded-lg p-4 space-y-2">
			<p className="text-sm font-medium flex items-center gap-2">
				<AlertCircle className="h-4 w-4" />
				Troubleshooting
			</p>
			{children}
		</div>
	);
}

function AutomationItem({
	label,
	description,
	status,
}: {
	label: string;
	description: string;
	status: "granted" | "denied" | "not-determined";
}) {
	const colors = {
		granted: "bg-green-500/20 text-green-600 dark:text-green-400",
		denied: "bg-red-500/20 text-red-600 dark:text-red-400",
		"not-determined": "bg-muted text-muted-foreground",
	};
	const labels = {
		granted: "Granted",
		denied: "Denied",
		"not-determined": "Not requested",
	};

	return (
		<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
			<div>
				<p className="text-sm font-medium">{label}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<span className={cn("text-xs px-2 py-1 rounded-full", colors[status])}>
				{labels[status]}
			</span>
		</div>
	);
}

function SummaryItem({
	label,
	status,
	required,
}: {
	label: string;
	status: "granted" | "denied" | "not-determined";
	required?: boolean;
}) {
	const colors = {
		granted: "bg-green-500/20 text-green-600 dark:text-green-400",
		denied: "bg-red-500/20 text-red-600 dark:text-red-400",
		"not-determined": "bg-muted text-muted-foreground",
	};
	const labels = {
		granted: "Granted",
		denied: "Denied",
		"not-determined": "Skipped",
	};

	return (
		<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
			<div className="flex items-center gap-2">
				<span className="text-sm">{label}</span>
				{required && <span className="text-xs text-red-500">*</span>}
			</div>
			<span className={cn("text-xs px-2 py-1 rounded-full", colors[status])}>
				{labels[status]}
			</span>
		</div>
	);
}
