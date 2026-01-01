export type Rgb = readonly [number, number, number];

export const DOT_ALPHA_BY_LEVEL: readonly [
	number,
	number,
	number,
	number,
	number,
] = [0, 0.14, 0.24, 0.38, 0.56];

export function rgba(rgb: Rgb, alpha: number): string {
	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function splitGradient(a: string, b: string, aRatio: number): string {
	const ratio = Math.min(1, Math.max(0, aRatio));
	const p = Math.round(ratio * 100);
	return `linear-gradient(90deg, ${a} 0% ${p}%, ${b} ${p}% 100%)`;
}
