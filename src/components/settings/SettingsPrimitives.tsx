import type { ReactNode } from "react";

export function SettingsTabHeader({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="space-y-1">
			<h2 className="text-lg font-medium">{title}</h2>
			<p className="text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

export function SettingsRows({ children }: { children: ReactNode }) {
	return <div className="divide-y divide-border/60">{children}</div>;
}

export function SettingsRow({
	title,
	description,
	right,
}: {
	title: string;
	description?: string;
	right: ReactNode;
}) {
	return (
		<div className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
			<div className="space-y-1">
				<div className="text-sm font-medium">{title}</div>
				{description ? (
					<div className="text-xs text-muted-foreground">{description}</div>
				) : null}
			</div>
			<div className="sm:justify-self-end">{right}</div>
		</div>
	);
}
