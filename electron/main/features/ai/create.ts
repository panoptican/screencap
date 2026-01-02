import { AiRouter } from "./AiRouter";
import { localBaselineProvider, localRetrievalProvider } from "./providers";
import type { ClassificationProvider } from "./types";

export const DEFAULT_CLASSIFICATION_PROVIDER_ORDER = [
	"local.retrieval",
	"local.baseline",
] as const;

export function createAiRouter(
	extraProviders: ClassificationProvider[] = [],
): AiRouter {
	return new AiRouter({
		providers: [
			localRetrievalProvider,
			localBaselineProvider,
			...extraProviders,
		],
	});
}
