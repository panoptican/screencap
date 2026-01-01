import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
	title,
	meta,
	right,
	className,
	children,
}: {
	title: string;
	meta?: string;
	right?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section
			className={cn(
				"relative overflow-hidden rounded-xl border border-border bg-card/40",
				className,
			)}
		>
			{/* [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--foreground))_1px,transparent_0)] [background-size:14px_14px] */}
			<div className="absolute inset-0 opacity-[0.08] " />
			<div className="relative p-5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="font-mono text-[11px] tracking-[0.28em] text-muted-foreground">
							{title.toUpperCase()}
						</div>
						{meta ? (
							<div className="mt-1 text-sm text-foreground/90">{meta}</div>
						) : null}
					</div>
					{right}
				</div>
				<div className="mt-4">{children}</div>
			</div>
		</section>
	);
}
