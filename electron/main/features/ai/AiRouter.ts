import { performance } from "node:perf_hooks";
import { createLogger } from "../../infra/log";
import type {
	ClassificationDecision,
	ClassificationInput,
	ClassificationProvider,
	ClassificationProviderContext,
	ProviderAttempt,
	ProviderAvailability,
} from "./types";

const logger = createLogger({ scope: "AiRouter" });

type RouterOptions = {
	providers: ClassificationProvider[];
};

function toMap(
	providers: ClassificationProvider[],
): Map<string, ClassificationProvider> {
	const map = new Map<string, ClassificationProvider>();
	for (const p of providers) {
		if (map.has(p.id)) {
			throw new Error(`Duplicate provider id: ${p.id}`);
		}
		map.set(p.id, p);
	}
	return map;
}

export class AiRouter {
	private readonly providers: Map<string, ClassificationProvider>;

	constructor(options: RouterOptions) {
		this.providers = toMap(options.providers);
	}

	async getAvailability(
		order: string[],
		ctx: ClassificationProviderContext,
	): Promise<Record<string, ProviderAvailability>> {
		const out: Record<string, ProviderAvailability> = {};
		for (const id of order) {
			const provider = this.providers.get(id);
			if (!provider) {
				out[id] = { available: false, reason: "Provider not registered" };
				continue;
			}
			try {
				out[id] = await provider.isAvailable(ctx);
			} catch (error) {
				out[id] = { available: false, reason: String(error) };
			}
		}
		return out;
	}

	async classify(
		input: ClassificationInput,
		ctx: ClassificationProviderContext,
		order: string[],
	): Promise<ClassificationDecision> {
		if (ctx.mode === "off") {
			return { ok: false, providerId: null, result: null, attempts: [] };
		}

		const attempts: ProviderAttempt[] = [];

		for (const id of order) {
			const provider = this.providers.get(id);
			if (!provider) {
				attempts.push({
					providerId: id,
					available: false,
					latencyMs: 0,
					error: "Provider not registered",
				});
				continue;
			}

			let availability: ProviderAvailability;
			try {
				availability = await provider.isAvailable(ctx);
			} catch (error) {
				attempts.push({
					providerId: id,
					available: false,
					latencyMs: 0,
					error: String(error),
				});
				continue;
			}

			if (!availability.available) {
				attempts.push({
					providerId: id,
					available: false,
					latencyMs: 0,
					error: availability.reason,
				});
				continue;
			}

			const started = performance.now();
			try {
				const result = await provider.classify(input, ctx);
				const latencyMs = Math.round(performance.now() - started);

				if (result) {
					attempts.push({
						providerId: id,
						available: true,
						latencyMs,
						error: null,
					});
					logger.debug("Classification succeeded", {
						providerId: id,
						latencyMs,
					});
					return { ok: true, providerId: id, result, attempts };
				}

				attempts.push({
					providerId: id,
					available: true,
					latencyMs,
					error: "Null result",
				});
			} catch (error) {
				const latencyMs = Math.round(performance.now() - started);
				attempts.push({
					providerId: id,
					available: true,
					latencyMs,
					error: String(error),
				});
			}
		}

		return { ok: false, providerId: null, result: null, attempts };
	}
}
