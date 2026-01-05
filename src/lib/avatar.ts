import type { AvatarSettings } from "@/types";

const LETTER_PATTERNS: Record<string, string[]> = {
	A: ["  █  ", " █ █ ", "█████", "█   █", "█   █"],
	B: ["████ ", "█   █", "████ ", "█   █", "████ "],
	C: [" ████", "█    ", "█    ", "█    ", " ████"],
	D: ["████ ", "█   █", "█   █", "█   █", "████ "],
	E: ["█████", "█    ", "███  ", "█    ", "█████"],
	F: ["█████", "█    ", "███  ", "█    ", "█    "],
	G: [" ████", "█    ", "█  ██", "█   █", " ████"],
	H: ["█   █", "█   █", "█████", "█   █", "█   █"],
	I: ["█████", "  █  ", "  █  ", "  █  ", "█████"],
	J: ["█████", "   █ ", "   █ ", "█  █ ", " ██  "],
	K: ["█   █", "█  █ ", "███  ", "█  █ ", "█   █"],
	L: ["█    ", "█    ", "█    ", "█    ", "█████"],
	M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
	N: ["█   █", "██  █", "█ █ █", "█  ██", "█   █"],
	O: [" ███ ", "█   █", "█   █", "█   █", " ███ "],
	P: ["████ ", "█   █", "████ ", "█    ", "█    "],
	Q: [" ███ ", "█   █", "█   █", "█  █ ", " ██ █"],
	R: ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
	S: [" ████", "█    ", " ███ ", "    █", "████ "],
	T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
	U: ["█   █", "█   █", "█   █", "█   █", " ███ "],
	V: ["█   █", "█   █", "█   █", " █ █ ", "  █  "],
	W: ["█   █", "█   █", "█ █ █", "██ ██", "█   █"],
	X: ["█   █", " █ █ ", "  █  ", " █ █ ", "█   █"],
	Y: ["█   █", " █ █ ", "  █  ", "  █  ", "  █  "],
	Z: ["█████", "   █ ", "  █  ", " █   ", "█████"],
};

function sanitizeAsciiChar(value: string | undefined): string {
	const first = (value ?? "@").slice(0, 1);
	if (!first.trim()) return "@";
	return first;
}

export const DEFAULT_AVATAR_COLORS = [
	"#0a0a0a",
	"#1a1a2e",
	"#16213e",
	"#0f3460",
	"#1b1b2f",
	"#162447",
	"#1f4068",
	"#2d132c",
	"#391d2a",
	"#4a1942",
	"#1e3a5f",
	"#2b5876",
	"#4e4376",
	"#1b4332",
	"#2d6a4f",
	"#40916c",
	"#5c4033",
	"#6b4423",
	"#7c3626",
];

export const DEFAULT_FOREGROUND_COLORS = [
	"#ffffff",
	"#e0e0e0",
	"#c0c0c0",
	"#f5f5f5",
	"#ffd700",
	"#00ff88",
	"#00d4ff",
	"#ff6b6b",
	"#a78bfa",
	"#f472b6",
];

export function getDefaultAvatarSettings(): AvatarSettings {
	return {
		pattern: "ascii",
		backgroundColor: "#0a0a0a",
		foregroundColor: "#ffffff",
		asciiChar: "@",
	};
}

function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	const r = Math.min(radius, width / 2, height / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + width - r, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + r);
	ctx.lineTo(x + width, y + height - r);
	ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	ctx.lineTo(x + r, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

function generateAsciiAvatar(
	ctx: CanvasRenderingContext2D,
	letter: string,
	size: number,
	settings: AvatarSettings,
) {
	const glyph = sanitizeAsciiChar(settings.asciiChar);
	const pattern = LETTER_PATTERNS[letter.toUpperCase()] ?? LETTER_PATTERNS.A;
	const rows = pattern.length;
	const cols = Math.max(...pattern.map((r) => r.length));

	const padding = size * 0.18;
	const availableSize = size - padding * 2;
	const cellSize = Math.floor(availableSize / Math.max(rows, cols));
	if (cellSize <= 0) return;

	const totalWidth = cols * cellSize;
	const totalHeight = rows * cellSize;
	const offsetX = (size - totalWidth) / 2;
	const offsetY = (size - totalHeight) / 2;

	const fontSize = cellSize * 1.15;
	ctx.font = `900 ${fontSize}px "SF Mono", "Monaco", "Menlo", monospace`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = settings.foregroundColor;

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < pattern[row].length; col++) {
			if (pattern[row][col] === "█") {
				ctx.fillText(
					glyph,
					offsetX + col * cellSize + cellSize / 2,
					offsetY + row * cellSize + cellSize / 2,
				);
			}
		}
	}
}

export function generateAvatarCanvas(
	letter: string,
	size: number,
	settings: AvatarSettings,
): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;

	const radius = size * 0.2;
	drawRoundedRect(ctx, 0, 0, size, size, radius);
	ctx.fillStyle = settings.backgroundColor;
	ctx.fill();

	// ASCII is the only supported style. We intentionally ignore `settings.pattern`
	// so any legacy values still render as ASCII.
	generateAsciiAvatar(ctx, letter, size, settings);

	return canvas;
}

export function generateAvatarDataUrl(
	letter: string,
	size: number,
	settings: AvatarSettings,
): string {
	const canvas = generateAvatarCanvas(letter, size, settings);
	return canvas.toDataURL("image/png");
}
