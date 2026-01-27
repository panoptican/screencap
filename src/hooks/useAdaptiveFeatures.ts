import { usePerformanceMode } from "@/contexts/PerformanceContext";

export function useAdaptiveAnimation() {
	const mode = usePerformanceMode();
	return {
		enabled: mode === "normal",
		durationMultiplier: mode === "normal" ? 1 : 0,
		transition:
			mode === "normal" ? { duration: 0.2, ease: "easeOut" as const } : { duration: 0 },
	};
}

export function useAdaptiveImageQuality() {
	const mode = usePerformanceMode();
	return {
		preferThumbnails: mode === "reduced",
		skipBrightnessDetection: mode === "reduced",
	};
}
