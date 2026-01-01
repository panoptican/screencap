import { IpcChannels } from "../../../shared/ipc";
import type { ContextStatus, ContextTestResult } from "../../../shared/types";
import { collectActivityContext } from "../../features/context";
import {
	checkScreenCapturePermission,
	getAccessibilityStatus,
	getAutomationStatus,
	getScreenCaptureStatus,
	openAccessibilitySettings,
	openAutomationSettings,
	openScreenCaptureSettings,
	requestAccessibilityPermission,
} from "../../features/permissions";
import { secureHandle } from "../secure";
import { ipcNoArgs } from "../validation";

export function registerPermissionHandlers(): void {
	secureHandle(IpcChannels.Permissions.CheckScreenCapture, ipcNoArgs, () => {
		return getScreenCaptureStatus();
	});

	secureHandle(IpcChannels.Permissions.HasScreenCapture, ipcNoArgs, () => {
		return checkScreenCapturePermission();
	});

	secureHandle(IpcChannels.Permissions.OpenSettings, ipcNoArgs, () => {
		openScreenCaptureSettings();
	});

	secureHandle(IpcChannels.Permissions.GetAccessibility, ipcNoArgs, () => {
		return getAccessibilityStatus();
	});

	secureHandle(IpcChannels.Permissions.RequestAccessibility, ipcNoArgs, () => {
		return requestAccessibilityPermission();
	});

	secureHandle(
		IpcChannels.Permissions.OpenAccessibilitySettings,
		ipcNoArgs,
		() => {
			openAccessibilitySettings();
		},
	);

	secureHandle(IpcChannels.Permissions.GetAutomation, ipcNoArgs, () => {
		return getAutomationStatus();
	});

	secureHandle(
		IpcChannels.Permissions.OpenAutomationSettings,
		ipcNoArgs,
		() => {
			openAutomationSettings();
		},
	);

	secureHandle(
		IpcChannels.Context.Test,
		ipcNoArgs,
		async (): Promise<ContextTestResult> => {
			try {
				const context = await collectActivityContext();

				if (!context) {
					return {
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
						error:
							"Failed to collect activity context. Check Accessibility permission.",
					};
				}

				return {
					success: true,
					appName: context.app.name,
					appBundleId: context.app.bundleId,
					windowTitle: context.window.title,
					isFullscreen: context.window.isFullscreen,
					urlHost: context.url?.host ?? null,
					contentKind: context.content?.kind ?? null,
					contentId: context.content?.id ?? null,
					contentTitle: context.content?.title ?? null,
					contextKey: context.key,
					provider: context.provider,
					confidence: context.confidence,
					error: null,
				};
			} catch (error) {
				return {
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
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		},
	);

	secureHandle(IpcChannels.Context.GetStatus, ipcNoArgs, (): ContextStatus => {
		return {
			screenCapture: getScreenCaptureStatus(),
			accessibility: getAccessibilityStatus(),
			automation: getAutomationStatus(),
		};
	});
}
