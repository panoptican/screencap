import { useEffect, useMemo, useRef } from "react";

function clampFps(fps: number) {
	if (!Number.isFinite(fps)) return 0;
	if (fps < 0) return 0;
	if (fps > 240) return 240;
	return fps;
}

function round1(n: number) {
	return Math.round(n * 10) / 10;
}

export function FpsGuard({
	thresholdFps = 45,
	sampleMs = 1000,
	windowSamples = 5,
	badSamplesToTrip = 3,
	warmupMs = 5000,
}: {
	thresholdFps?: number;
	sampleMs?: number;
	windowSamples?: number;
	badSamplesToTrip?: number;
	warmupMs?: number;
}) {
	const enabled = useMemo(() => {
		const forced = import.meta.env.VITE_FPS_GUARD;
		if (forced === "0") return false;
		return true;
	}, []);

	const rafIdRef = useRef<number | null>(null);
	const framesRef = useRef(0);
	const lastSampleAtRef = useRef<number | null>(null);
	const windowRef = useRef<number[]>([]);
	const badStreakRef = useRef(0);
	const hasTrippedRef = useRef(false);
	const startedAtRef = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) return;

		startedAtRef.current = performance.now();

		const tick = () => {
			framesRef.current += 1;
			rafIdRef.current = window.requestAnimationFrame(tick);
		};

		rafIdRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (rafIdRef.current != null)
				window.cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;

		const reset = () => {
			framesRef.current = 0;
			lastSampleAtRef.current = null;
			windowRef.current = [];
			badStreakRef.current = 0;
			hasTrippedRef.current = false;
		};

		const interval = window.setInterval(() => {
			const visible = document.visibilityState === "visible";
			if (!visible) {
				reset();
				return;
			}

			const now = performance.now();
			const startedAt = startedAtRef.current;
			if (startedAt != null && now - startedAt < warmupMs) {
				reset();
				return;
			}

			const last = lastSampleAtRef.current;
			lastSampleAtRef.current = now;

			const delta = last == null ? sampleMs : now - last;
			const frames = framesRef.current;
			framesRef.current = 0;

			const fps = clampFps((frames * 1000) / Math.max(1, delta));
			const w = windowRef.current;
			w.push(fps);
			while (w.length > windowSamples) w.shift();
			const avgFps =
				w.length === 0 ? fps : w.reduce((a, b) => a + b, 0) / w.length;

			const isBad = avgFps < thresholdFps;
			badStreakRef.current = isBad ? badStreakRef.current + 1 : 0;

			if (badStreakRef.current >= badSamplesToTrip && !hasTrippedRef.current) {
				hasTrippedRef.current = true;
				console.error(
					[
						"████████████████████████████████████████████████████████████",
						"█                        FPS DROP DETECTED                 █",
						"████████████████████████████████████████████████████████████",
						`route=${window.location.pathname}${window.location.hash}`,
						`avg=${round1(avgFps)} fps (window=${w.length} samples), last=${round1(fps)} fps`,
						`threshold=${thresholdFps} fps, badSamplesToTrip=${badSamplesToTrip}, sampleMs=${sampleMs}`,
						`warmupMs=${warmupMs}`,
					].join("\n"),
				);
			}

			if (!isBad && hasTrippedRef.current) {
				hasTrippedRef.current = false;
				console.error(
					`FPS recovered: route=${window.location.pathname}${window.location.hash} avg=${round1(avgFps)} fps last=${round1(fps)} fps`,
				);
			}
		}, sampleMs);

		return () => window.clearInterval(interval);
	}, [
		badSamplesToTrip,
		enabled,
		sampleMs,
		thresholdFps,
		warmupMs,
		windowSamples,
	]);

	return null;
}
