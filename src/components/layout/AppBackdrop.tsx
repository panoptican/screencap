import { Noise } from "@/components/ui/noise";

export function AppBackdrop() {
	return (
		<div className="pointer-events-none absolute inset-0">
			<div className="absolute inset-0 opacity-[0.03] mix-blend-overlay">
				<Noise />
			</div>
		</div>
	);
}
