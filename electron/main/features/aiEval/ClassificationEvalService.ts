import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import type { Event } from "../../../shared/types";
import { getEvents } from "../../infra/db/repositories/EventRepository";
import { createLogger } from "../../infra/log";
import { getApiKey } from "../../infra/settings";
import { classifyScreenshot } from "../llm/ClassificationService";
import {
	callOpenRouter,
	getOpenRouterCallRecords,
	resetOpenRouterCallRecords,
} from "../llm/OpenRouterClient";
import type { ScreenContext } from "../llm/prompts";

const logger = createLogger({ scope: "ClassificationEval" });

const StrategySchema = z.enum(["vision", "text", "local"]);
type Strategy = z.infer<typeof StrategySchema>;

const CategorySchema = z.enum([
	"Study",
	"Work",
	"Leisure",
	"Chores",
	"Social",
	"Unknown",
]);

const TextOnlySchema = z.object({
	category: CategorySchema,
	caption: z.string().min(1).max(200),
	confidence: z.number().min(0).max(1),
});

type TextOnlyResult = z.infer<typeof TextOnlySchema>;

export type ClassificationEvalOptions = {
	limit: number;
	strategies: Strategy[];
};

type StrategyRun = {
	strategy: Strategy;
	eventId: string;
	ok: boolean;
	latencyMs: number;
	category: string | null;
	caption: string | null;
	confidence: number | null;
	cacheHit: boolean;
	error: string | null;
};

function toScreenContext(event: Event): ScreenContext | null {
	if (
		!event.appBundleId &&
		!event.appName &&
		!event.windowTitle &&
		!event.urlHost &&
		!event.contentKind &&
		!event.contentTitle
	) {
		return null;
	}
	return {
		appBundleId: event.appBundleId,
		appName: event.appName,
		windowTitle: event.windowTitle,
		urlHost: event.urlHost,
		contentKind: event.contentKind,
		contentTitle: event.contentTitle,
		userCaption: null,
		selectedProject: null,
	};
}

function safeReadBase64(path: string | null): string | null {
	if (!path) return null;
	try {
		return readFileSync(path).toString("base64");
	} catch {
		return null;
	}
}

function cacheKey(event: Event): string | null {
	const stableHash = event.stableHash;
	const contextKey = event.contextKey;
	if (!stableHash || !contextKey) return null;
	return `${stableHash}:${contextKey}`;
}

function buildLocalBaseline(event: Event): TextOnlyResult {
	const caption =
		event.contentTitle?.trim() ||
		event.windowTitle?.trim() ||
		event.appName?.trim() ||
		"Screenshot captured";
	return { category: "Unknown", caption, confidence: 0 };
}

function buildTextPrompt(): string {
	return `You classify a user's on-device screen activity using ONLY structured context metadata (not pixels).

Return ONLY valid JSON matching this schema:
{
  "category": "Study" | "Work" | "Leisure" | "Chores" | "Social" | "Unknown",
  "caption": string,
  "confidence": number
}

Rules:
- If context is insufficient, use category "Unknown" with low confidence (<= 0.4).
- caption must be 3-8 words, specific, grounded in context.
- confidence must be in [0,1].
`;
}

async function runTextStrategy(input: {
	context: ScreenContext | null;
}): Promise<TextOnlyResult> {
	return callOpenRouter<TextOnlyResult>(
		[
			{ role: "system", content: buildTextPrompt() },
			{
				role: "user",
				content: JSON.stringify({ context: input.context }, null, 2),
			},
		],
		TextOnlySchema,
		{ maxTokens: 200, temperature: 0 },
	);
}

function summarizeRuns(runs: StrategyRun[]): void {
	const byStrategy = new Map<Strategy, StrategyRun[]>();
	for (const r of runs) {
		const list = byStrategy.get(r.strategy) ?? [];
		list.push(r);
		byStrategy.set(r.strategy, list);
	}

	for (const [strategy, list] of byStrategy) {
		const ok = list.filter((r) => r.ok).length;
		const avgMs =
			list.reduce((acc, r) => acc + r.latencyMs, 0) / Math.max(1, list.length);
		const cacheHits = list.filter((r) => r.cacheHit).length;
		logger.info("Strategy summary", {
			strategy,
			runs: list.length,
			ok,
			errors: list.length - ok,
			avgLatencyMs: Math.round(avgMs),
			cacheHitRate: list.length === 0 ? 0 : cacheHits / list.length,
		});
	}

	const calls = getOpenRouterCallRecords();
	const byDay = new Map<string, number>();
	for (const c of calls) {
		const day = new Date(c.timestamp).toISOString().slice(0, 10);
		byDay.set(day, (byDay.get(day) ?? 0) + 1);
	}
	logger.info("OpenRouter call volume", {
		totalCalls: calls.length,
		byDay: Object.fromEntries(
			[...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
		),
	});
}

function compareAgreement(runs: StrategyRun[]): void {
	const byEvent = new Map<string, StrategyRun[]>();
	for (const r of runs) {
		const list = byEvent.get(r.eventId) ?? [];
		list.push(r);
		byEvent.set(r.eventId, list);
	}

	let comparable = 0;
	let agreeAll = 0;

	for (const [, list] of byEvent) {
		const categories = list
			.map((r) => r.category)
			.filter((c): c is string => typeof c === "string" && c.length > 0);
		if (categories.length < 2) continue;
		comparable++;
		const first = categories[0];
		if (categories.every((c) => c === first)) agreeAll++;
	}

	logger.info("Agreement", {
		comparableEvents: comparable,
		agreeAll,
		agreeAllRate: comparable === 0 ? 0 : agreeAll / comparable,
	});
}

export async function runClassificationEval(
	options: ClassificationEvalOptions,
): Promise<void> {
	resetOpenRouterCallRecords();

	const strategies = options.strategies.map((s) => StrategySchema.parse(s));
	const limit = Math.max(1, Math.min(200, Math.floor(options.limit)));

	const apiKey = getApiKey();
	const events = getEvents({ limit: limit * 3 }).filter(
		(e) => e.status === "completed" && !!e.originalPath,
	);
	const sample = events.slice(0, limit);

	logger.info("Starting evaluation", {
		limit,
		strategies,
		sampled: sample.length,
		hasApiKey: !!apiKey,
	});

	const caches = new Map<Strategy, Map<string, TextOnlyResult | null>>();
	for (const s of strategies) {
		caches.set(s, new Map());
	}

	const runs: StrategyRun[] = [];

	for (const event of sample) {
		const context = toScreenContext(event);
		const base64 = safeReadBase64(event.originalPath);
		const key = cacheKey(event);

		for (const strategy of strategies) {
			if ((strategy === "vision" || strategy === "text") && !apiKey) {
				runs.push({
					strategy,
					eventId: event.id,
					ok: false,
					latencyMs: 0,
					category: null,
					caption: null,
					confidence: null,
					cacheHit: false,
					error: "No API key configured",
				});
				continue;
			}

			if (strategy === "vision" && !base64) {
				runs.push({
					strategy,
					eventId: event.id,
					ok: false,
					latencyMs: 0,
					category: null,
					caption: null,
					confidence: null,
					cacheHit: false,
					error: "Missing screenshot",
				});
				continue;
			}

			const cache = caches.get(strategy);
			if (key && cache?.has(key)) {
				const cached = cache.get(key) ?? null;
				runs.push({
					strategy,
					eventId: event.id,
					ok: !!cached,
					latencyMs: 0,
					category: cached?.category ?? null,
					caption: cached?.caption ?? null,
					confidence: cached?.confidence ?? null,
					cacheHit: true,
					error: cached ? null : "Cached null",
				});
				continue;
			}

			const started = performance.now();
			try {
				let result: TextOnlyResult | null = null;

				if (strategy === "local") {
					result = buildLocalBaseline(event);
				} else if (strategy === "text") {
					result = await runTextStrategy({ context });
				} else if (strategy === "vision") {
					const full = await classifyScreenshot(base64!, context);
					result = full
						? {
								category: full.category,
								caption: full.caption,
								confidence: full.confidence,
							}
						: null;
				}

				const latencyMs = Math.round(performance.now() - started);
				if (key) cache?.set(key, result);

				runs.push({
					strategy,
					eventId: event.id,
					ok: !!result,
					latencyMs,
					category: result?.category ?? null,
					caption: result?.caption ?? null,
					confidence: result?.confidence ?? null,
					cacheHit: false,
					error: null,
				});
			} catch (error) {
				const latencyMs = Math.round(performance.now() - started);
				runs.push({
					strategy,
					eventId: event.id,
					ok: false,
					latencyMs,
					category: null,
					caption: null,
					confidence: null,
					cacheHit: false,
					error: String(error),
				});
			}
		}
	}

	summarizeRuns(runs);
	compareAgreement(runs);
}
