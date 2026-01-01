import { IpcChannels } from "../../../shared/ipc";
import type { EventSummary, PeriodType } from "../../../shared/types";
import {
	classifyScreenshot,
	generateStory,
	testConnection,
} from "../../features/llm";
import { secureHandle } from "../secure";
import {
	ipcLlmClassifyArgs,
	ipcLlmGenerateStoryArgs,
	ipcNoArgs,
} from "../validation";

export function registerLLMHandlers(): void {
	secureHandle(
		IpcChannels.LLM.Classify,
		ipcLlmClassifyArgs,
		async (imageBase64: string) => {
			return classifyScreenshot(imageBase64);
		},
	);

	secureHandle(
		IpcChannels.LLM.GenerateStory,
		ipcLlmGenerateStoryArgs,
		async (events: EventSummary[], periodType: PeriodType) => {
			return generateStory(events, periodType);
		},
	);

	secureHandle(IpcChannels.LLM.TestConnection, ipcNoArgs, async () => {
		return testConnection();
	});
}
