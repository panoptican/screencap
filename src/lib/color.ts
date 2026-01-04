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

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 31 + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

const APP_COLOR_PALETTE: readonly Rgb[] = [
	[59, 130, 246],
	[34, 197, 94],
	[168, 85, 247],
	[236, 72, 153],
	[245, 158, 11],
	[6, 182, 212],
	[239, 68, 68],
	[16, 185, 129],
	[139, 92, 246],
	[244, 63, 94],
	[99, 102, 241],
	[20, 184, 166],
	[251, 146, 60],
	[132, 204, 22],
	[234, 179, 8],
	[217, 70, 239],
];

export function appNameToRgb(appName: string): Rgb {
	const index = hashString(appName) % APP_COLOR_PALETTE.length;
	return APP_COLOR_PALETTE[index];
}
