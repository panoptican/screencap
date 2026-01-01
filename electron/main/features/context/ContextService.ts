import { createLogger } from "../../infra/log";
import { buildActivityContext } from "./keyBuilder";
import {
	collectForegroundSnapshot,
	getContextProviders,
	isBackgroundCapable,
} from "./providers";
import type {
	ActivityContext,
	BackgroundContext,
	ContentDescriptor,
	ContextEnrichment,
	ForegroundSnapshot,
	UrlMetadata,
} from "./types";

const logger = createLogger({ scope: "ContextService" });

interface EnrichmentResult {
	enrichment: ContextEnrichment;
	providerId: string;
}

interface MergedEnrichment {
	url: UrlMetadata | null;
	content: ContentDescriptor | null;
	confidence: number;
	provider: string;
	providersUsed: string[];
}

async function collectAllEnrichments(
	snapshot: ForegroundSnapshot,
): Promise<EnrichmentResult[]> {
	const providers = getContextProviders();
	const results: EnrichmentResult[] = [];

	for (const provider of providers) {
		if (!provider.supports(snapshot)) continue;

		try {
			const enrichment = await provider.collect(snapshot);
			if (enrichment) {
				results.push({ enrichment, providerId: provider.id });
			}
		} catch (error) {
			logger.debug("Provider failed", { id: provider.id, error });
		}
	}

	return results;
}

async function collectBackgroundContexts(
	_foregroundBundleId: string,
): Promise<BackgroundContext[]> {
	const providers = getContextProviders();
	const results: BackgroundContext[] = [];

	for (const provider of providers) {
		if (!isBackgroundCapable(provider)) continue;

		try {
			const bg = await provider.collectBackground();
			if (bg) {
				results.push(bg);
			}
		} catch (error) {
			logger.debug("Background provider failed", { id: provider.id, error });
		}
	}

	return results;
}

function mergeEnrichments(results: EnrichmentResult[]): MergedEnrichment {
	if (results.length === 0) {
		return {
			url: null,
			content: null,
			confidence: 0.3,
			provider: "none",
			providersUsed: [],
		};
	}

	let bestContent: {
		content: ContentDescriptor;
		confidence: number;
		providerId: string;
	} | null = null;
	let bestUrl: {
		url: UrlMetadata;
		confidence: number;
		providerId: string;
	} | null = null;

	for (const { enrichment, providerId } of results) {
		if (enrichment.content) {
			if (!bestContent || enrichment.confidence > bestContent.confidence) {
				bestContent = {
					content: enrichment.content,
					confidence: enrichment.confidence,
					providerId,
				};
			}
		}

		if (enrichment.url) {
			if (!bestUrl || enrichment.confidence > bestUrl.confidence) {
				bestUrl = {
					url: enrichment.url,
					confidence: enrichment.confidence,
					providerId,
				};
			}
		}
	}

	const primaryProvider =
		bestContent?.providerId ?? bestUrl?.providerId ?? "none";
	const confidence = bestContent?.confidence ?? bestUrl?.confidence ?? 0.3;
	const providersUsed = Array.from(new Set(results.map((r) => r.providerId)));

	return {
		url: bestUrl?.url ?? null,
		content: bestContent?.content ?? null,
		confidence,
		provider: primaryProvider,
		providersUsed,
	};
}

function filterBackgroundForForeground(
	background: BackgroundContext[],
	foregroundProvider: string,
): BackgroundContext[] {
	return background.filter((bg) => bg.provider !== foregroundProvider);
}

export async function collectActivityContext(): Promise<ActivityContext | null> {
	const snapshot = await collectForegroundSnapshot();
	if (!snapshot) {
		logger.debug("No foreground snapshot available");
		return null;
	}

	const [foregroundResults, backgroundResults] = await Promise.all([
		collectAllEnrichments(snapshot),
		collectBackgroundContexts(snapshot.app.bundleId),
	]);

	const merged = mergeEnrichments(foregroundResults);

	const background = filterBackgroundForForeground(
		backgroundResults,
		merged.provider,
	);

	const context = buildActivityContext(
		snapshot.capturedAt,
		snapshot.app,
		snapshot.window,
		merged.url,
		merged.content,
		merged.provider,
		merged.confidence,
		background,
	);

	logger.debug("Activity context collected", {
		key: context.key,
		app: context.app.bundleId,
		provider: merged.provider,
		providersUsed: merged.providersUsed,
		backgroundCount: background.length,
		isFullscreen: context.window.isFullscreen,
	});

	return context;
}

export function getRegisteredProviders(): string[] {
	return getContextProviders().map((p) => p.id);
}
