import { useCallback, useEffect, useState } from "react";
import type { AutomationStatus, ContextStatus } from "@/types";

export interface OnboardingStatus {
	screenCaptureStatus: "granted" | "denied" | "not-determined";
	accessibilityStatus: "granted" | "denied" | "not-determined";
	automationStatus: AutomationStatus;
	canCapture: boolean;
	hasFullContext: boolean;
	isLoading: boolean;
}

export function useOnboardingStatus(pollInterval = 2000) {
	const [status, setStatus] = useState<OnboardingStatus>({
		screenCaptureStatus: "not-determined",
		accessibilityStatus: "not-determined",
		automationStatus: {
			systemEvents: "not-determined",
			browsers: "not-determined",
			apps: "not-determined",
		},
		canCapture: false,
		hasFullContext: false,
		isLoading: true,
	});

	const refresh = useCallback(async () => {
		if (!window.api) return;

		const contextStatus: ContextStatus = await window.api.context.getStatus();

		const canCapture = contextStatus.screenCapture === "granted";
		const hasFullContext =
			contextStatus.accessibility === "granted" &&
			contextStatus.automation.systemEvents === "granted";

		setStatus({
			screenCaptureStatus: contextStatus.screenCapture,
			accessibilityStatus: contextStatus.accessibility,
			automationStatus: contextStatus.automation,
			canCapture,
			hasFullContext,
			isLoading: false,
		});
	}, []);

	useEffect(() => {
		refresh();
		const interval = setInterval(refresh, pollInterval);
		return () => clearInterval(interval);
	}, [refresh, pollInterval]);

	return { ...status, refresh };
}
