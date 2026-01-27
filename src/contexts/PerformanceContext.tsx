import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";

export type PerformanceMode = "normal" | "reduced";

interface PerformanceState {
	mode: PerformanceMode;
	avgFps: number;
	isLowPerformance: boolean;
}

interface PerformanceContextValue extends PerformanceState {
	/** Force a specific mode (useful for testing/user preference) */
	forceMode: (mode: PerformanceMode | null) => void;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function usePerformance(): PerformanceContextValue {
	const ctx = useContext(PerformanceContext);
	if (!ctx) {
		return {
			mode: "normal",
			avgFps: 60,
			isLowPerformance: false,
			forceMode: () => {},
		};
	}
	return ctx;
}

export function usePerformanceMode(): PerformanceMode {
	return usePerformance().mode;
}

interface PerformanceProviderProps {
	children: ReactNode;
	thresholdFps?: number;
	sampleMs?: number;
	windowSamples?: number;
	badSamplesToTrip?: number;
	goodSamplesToRecover?: number;
	warmupMs?: number;
}

function clampFps(fps: number): number {
	if (!Number.isFinite(fps)) return 0;
	if (fps < 0) return 0;
	if (fps > 240) return 240;
	return fps;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export function PerformanceProvider({
	children,
	thresholdFps = 45,
	sampleMs = 1000,
	windowSamples = 5,
	badSamplesToTrip = 3,
	goodSamplesToRecover = 3,
	warmupMs = 5000,
}: PerformanceProviderProps) {
	const [state, setState] = useState<PerformanceState>({
		mode: "normal",
		avgFps: 60,
		isLowPerformance: false,
	});
	const [forcedMode, setForcedMode] = useState<PerformanceMode | null>(null);

	const enabled = useMemo(() => {
		const forced = import.meta.env.VITE_FPS_GUARD;
		return forced !== "0";
	}, []);

	const rafIdRef = useRef<number | null>(null);
	const framesRef = useRef(0);
	const lastSampleAtRef = useRef<number | null>(null);
	const windowRef = useRef<number[]>([]);
	const badStreakRef = useRef(0);
	const goodStreakRef = useRef(0);
	const startedAtRef = useRef<number | null>(null);
	const hasLoggedTripRef = useRef(false);

	useEffect(() => {
		if (!enabled) return;

		startedAtRef.current = performance.now();

		const tick = () => {
			framesRef.current += 1;
			rafIdRef.current = window.requestAnimationFrame(tick);
		};

		rafIdRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (rafIdRef.current != null) {
				window.cancelAnimationFrame(rafIdRef.current);
			}
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;

		const reset = () => {
			framesRef.current = 0;
			lastSampleAtRef.current = null;
			windowRef.current = [];
			badStreakRef.current = 0;
			goodStreakRef.current = 0;
		};

		const interval = window.setInterval(() => {
			if (document.visibilityState !== "visible") {
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

			if (isBad) {
				badStreakRef.current += 1;
				goodStreakRef.current = 0;
			} else {
				goodStreakRef.current += 1;
				badStreakRef.current = 0;
			}

			const shouldBeReduced = badStreakRef.current >= badSamplesToTrip;
			const shouldRecover = goodStreakRef.current >= goodSamplesToRecover;

			setState((prev) => {
				const newMode = shouldBeReduced
					? "reduced"
					: shouldRecover
						? "normal"
						: prev.mode;

				if (newMode === "reduced" && prev.mode !== "reduced") {
					if (!hasLoggedTripRef.current) {
						hasLoggedTripRef.current = true;
						console.warn(
							`[Performance] Switching to reduced mode: avg=${round1(avgFps)} fps`,
						);
					}
				} else if (newMode === "normal" && prev.mode === "reduced") {
					hasLoggedTripRef.current = false;
					console.info(
						`[Performance] Recovered to normal mode: avg=${round1(avgFps)} fps`,
					);
				}

				if (prev.mode === newMode && Math.abs(prev.avgFps - avgFps) < 1) {
					return prev;
				}

				return {
					mode: newMode,
					avgFps: round1(avgFps),
					isLowPerformance: newMode === "reduced",
				};
			});
		}, sampleMs);

		return () => window.clearInterval(interval);
	}, [
		enabled,
		sampleMs,
		thresholdFps,
		windowSamples,
		badSamplesToTrip,
		goodSamplesToRecover,
		warmupMs,
	]);

	const value = useMemo<PerformanceContextValue>(
		() => ({
			mode: forcedMode ?? state.mode,
			avgFps: state.avgFps,
			isLowPerformance: (forcedMode ?? state.mode) === "reduced",
			forceMode: setForcedMode,
		}),
		[state, forcedMode],
	);

	return (
		<PerformanceContext.Provider value={value}>
			{children}
		</PerformanceContext.Provider>
	);
}
