import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { app } from "electron";
import sharp from "sharp";
import { z } from "zod";
import type { OcrResult } from "../../../shared/types";
import { createLogger } from "../../infra/log";

const logger = createLogger({ scope: "OcrService" });

const execFileAsync = promisify(execFile);

const OcrLineSchema = z.object({
	text: z.string(),
	confidence: z.number().min(0).max(1),
});

const OcrOutputSchema = z.object({
	ok: z.boolean(),
	text: z.string(),
	lines: z.array(OcrLineSchema),
	confidence: z.number().min(0).max(1),
	durationMs: z.number().int().nonnegative(),
	error: z.string().nullable().optional(),
});

type OcrOutput = z.infer<typeof OcrOutputSchema>;

function getBinaryPath(): string {
	if (app.isPackaged) {
		return join(process.resourcesPath, "ocr", "screencap-ocr");
	}
	return join(process.cwd(), "build", "ocr", "screencap-ocr");
}

async function runBinary(imagePath: string): Promise<OcrOutput> {
	const binary = getBinaryPath();
	if (!existsSync(binary)) {
		throw new Error(`OCR binary not found at ${binary}`);
	}

	const { stdout } = await execFileAsync(binary, [imagePath], {
		timeout: 60_000,
		maxBuffer: 10 * 1024 * 1024,
	});

	const parsed = JSON.parse(String(stdout)) as unknown;
	return OcrOutputSchema.parse(parsed);
}

export async function recognizeTextFromImagePath(
	imagePath: string,
): Promise<OcrResult> {
	const output = await runBinary(imagePath);
	if (!output.ok) {
		throw new Error(output.error ?? "ocr_failed");
	}
	return {
		text: output.text,
		lines: output.lines,
		confidence: output.confidence,
		durationMs: output.durationMs,
	};
}

export async function recognizeTextFromWebpBase64(
	imageBase64: string,
): Promise<OcrResult> {
	const dir = await mkdtemp(join(tmpdir(), "screencap-ocr-"));
	const pngPath = join(dir, "input.png");
	try {
		const input = Buffer.from(imageBase64, "base64");
		const png = await sharp(input).png().toBuffer();
		await writeFile(pngPath, png);
		return await recognizeTextFromImagePath(pngPath);
	} catch (error) {
		logger.warn("OCR failed", { error: String(error) });
		throw error;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}
