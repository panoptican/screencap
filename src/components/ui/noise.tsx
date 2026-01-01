import { useId } from "react";
import { cn } from "@/lib/utils";

interface NoiseProps {
	className?: string;
}

export function Noise({ className }: NoiseProps) {
	const id = useId();
	const filterId = `noise-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

	return (
		<svg
			className={cn("h-full w-full", className)}
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<filter id={filterId}>
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.8"
					numOctaves="4"
					stitchTiles="stitch"
				/>
			</filter>
			<rect width="100%" height="100%" filter={`url(#${filterId})`} />
		</svg>
	);
}
