import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%*+=-?;";
const cornerChars = "abcdefghijklmnopqrstuvwxyz";
const borderPx = 8;
const charWidthPx = 3.6;
const charHeightPx = 6;
const words = [
	"SCREEN",
	"CAPTURE",
	"PRIVACY",
	"LOCAL",
	"FOCUS",
	"STORY",
	"INSIGHT",
	"TIMELINE",
	"CONTEXT",
	"AUTOMATE",
	"SECURE",
] as const;

function generateLine(length: number) {
	let line = "";
	while (line.length < length) {
		if (Math.random() < 0.1) {
			const word = words[Math.floor(Math.random() * words.length)];
			if (line.length + word.length <= length) {
				line += word;
				continue;
			}
		}
		line += chars[Math.floor(Math.random() * chars.length)];
	}
	return line;
}

function randomCornerChar() {
	return cornerChars[Math.floor(Math.random() * cornerChars.length)];
}

function mutateLine(line: string, active: boolean) {
	if (!line) return line;
	const arr = line.split("");
	const changes = Math.max(1, Math.floor(arr.length * (active ? 0.15 : 0.03)));
	for (let i = 0; i < changes; i++) {
		const idx = Math.floor(Math.random() * arr.length);
		arr[idx] = chars[Math.floor(Math.random() * chars.length)];
	}
	if (Math.random() < (active ? 0.2 : 0.05)) {
		const word = words[Math.floor(Math.random() * words.length)];
		if (arr.length >= word.length) {
			const pos = Math.floor(Math.random() * (arr.length - word.length));
			for (let i = 0; i < word.length; i++) arr[pos + i] = word[i];
		}
	}
	return arr.join("");
}

export function MatrixBorder({
	children,
	active = false,
	className,
	speed = 50,
	baseSpeed = 150,
}: {
	children: React.ReactNode;
	active?: boolean;
	className?: string;
	speed?: number;
	baseSpeed?: number;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [lines, setLines] = useState<{
		top: string;
		bottom: string;
		left: string;
		right: string;
		tl: string;
		tr: string;
		bl: string;
		br: string;
	}>({
		top: "",
		bottom: "",
		left: "",
		right: "",
		tl: "a",
		tr: "a",
		bl: "a",
		br: "a",
	});

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const calculate = () => {
			const { width, height } = el.getBoundingClientRect();
			const cols = Math.max(1, Math.ceil(width / charWidthPx) + 12);
			const rows = Math.max(1, Math.ceil(height / charHeightPx) + 12);
			return { cols, rows };
		};

		const update = () => {
			const { cols, rows } = calculate();
			setLines({
				top: generateLine(cols),
				bottom: generateLine(cols),
				left: generateLine(rows),
				right: generateLine(rows),
				tl: randomCornerChar(),
				tr: randomCornerChar(),
				bl: randomCornerChar(),
				br: randomCornerChar(),
			});
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const interval = window.setInterval(
			() => {
				setLines((prev) => ({
					top: mutateLine(prev.top, active),
					bottom: mutateLine(prev.bottom, active),
					left: mutateLine(prev.left, active),
					right: mutateLine(prev.right, active),
					tl: Math.random() < 0.2 ? randomCornerChar() : prev.tl,
					tr: Math.random() < 0.2 ? randomCornerChar() : prev.tr,
					bl: Math.random() < 0.2 ? randomCornerChar() : prev.bl,
					br: Math.random() < 0.2 ? randomCornerChar() : prev.br,
				}));
			},
			active ? speed : baseSpeed,
		);
		return () => window.clearInterval(interval);
	}, [active, speed, baseSpeed]);

	return (
		<div
			ref={containerRef}
			className={cn("relative group w-full rounded-lg box-border", className)}
		>
			<div className="relative z-0 w-full rounded-lg overflow-hidden">
				{children}
			</div>

			<div
				className={cn(
					"pointer-events-none absolute inset-0 z-10 select-none transition-colors duration-300 text-[6px] leading-[1] font-mono",
					"text-zinc-600 group-hover:text-gray-200",
				)}
			>
				<div
					className="absolute top-0 left-0 right-0 overflow-hidden whitespace-nowrap flex items-center"
					style={{ height: borderPx }}
				>
					{lines.top}
				</div>
				<div
					className="absolute bottom-0 left-0 right-0 overflow-hidden whitespace-nowrap flex items-center"
					style={{ height: borderPx }}
				>
					{lines.bottom}
				</div>
				<div
					className="absolute overflow-hidden flex flex-col items-center"
					style={{ left: -6, width: borderPx, top: borderPx, bottom: borderPx }}
				>
					{lines.left.split("").map((c, i) => (
						<span key={`${i}-${c}`}>{c}</span>
					))}
				</div>
				<div
					className="absolute overflow-hidden flex flex-col items-center"
					style={{
						right: -6,
						width: borderPx,
						top: borderPx,
						bottom: borderPx,
					}}
				>
					{lines.right.split("").map((c, i) => (
						<span key={`${i}-${c}`}>{c}</span>
					))}
				</div>
				<div
					className="absolute top-0 flex items-center justify-center"
					style={{ left: -6, width: borderPx, height: borderPx }}
				>
					{lines.tl}
				</div>
				<div
					className="absolute top-0 flex items-center justify-center"
					style={{ right: -6, width: borderPx, height: borderPx }}
				>
					{lines.tr}
				</div>
				<div
					className="absolute bottom-0 flex items-center justify-center"
					style={{ left: -6, width: borderPx, height: borderPx }}
				>
					{lines.bl}
				</div>
				<div
					className="absolute bottom-0 flex items-center justify-center"
					style={{ right: -6, width: borderPx, height: borderPx }}
				>
					{lines.br}
				</div>
			</div>
		</div>
	);
}
