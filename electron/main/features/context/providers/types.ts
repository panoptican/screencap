import type {
	BackgroundContext,
	ContextEnrichment,
	ForegroundSnapshot,
} from "../types";

export interface ContextProvider {
	id: string;
	priority?: number;
	supports(snapshot: ForegroundSnapshot): boolean;
	collect(snapshot: ForegroundSnapshot): Promise<ContextEnrichment | null>;
}

export interface BackgroundCapableProvider extends ContextProvider {
	collectBackground(): Promise<BackgroundContext | null>;
}

export function isBackgroundCapable(
	provider: ContextProvider,
): provider is BackgroundCapableProvider {
	return (
		"collectBackground" in provider &&
		typeof (provider as BackgroundCapableProvider).collectBackground ===
			"function"
	);
}
