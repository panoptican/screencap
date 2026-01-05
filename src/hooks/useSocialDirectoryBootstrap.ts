import { useEffect } from "react";
import { useSocialDirectoryStore } from "@/stores/socialDirectory";

export function useSocialDirectoryBootstrap(options?: {
	pollIntervalMs?: number;
}) {
	const pollIntervalMs = options?.pollIntervalMs ?? 30_000;
	const refresh = useSocialDirectoryStore((s) => s.refresh);

	useEffect(() => {
		void refresh({ force: true });
		const interval = setInterval(() => void refresh(), pollIntervalMs);
		return () => clearInterval(interval);
	}, [pollIntervalMs, refresh]);
}
