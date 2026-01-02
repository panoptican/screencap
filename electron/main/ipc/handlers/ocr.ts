import { IpcChannels } from "../../../shared/ipc";
import type { OcrResult } from "../../../shared/types";
import { recognizeTextFromWebpBase64 } from "../../features/ocr";
import { secureHandle } from "../secure";
import { ipcOcrRecognizeArgs } from "../validation";

export function registerOcrHandlers(): void {
	secureHandle(
		IpcChannels.Ocr.Recognize,
		ipcOcrRecognizeArgs,
		async (imageBase64: string): Promise<OcrResult> => {
			return recognizeTextFromWebpBase64(imageBase64);
		},
	);
}
