import { Search, Settings } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";

function isMac(): boolean {
	return navigator.platform.toLowerCase().includes("mac");
}

export function Titlebar() {
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

	const mac = useMemo(isMac, []);
	const shortcut = mac ? "K" : "Ctrl K";

	return (
		<header
			className={cn(
				"drag-region flex pt-1.5 items-center bg-card/50 text-foreground",
				mac ? "pl-[48px]" : "",
			)}
		>
			<div className="grid w-full grid-cols-[1fr,minmax(0,420px),1fr] items-center gap-3 pb-1.5 pr-1.5">
				<div className="h-7" />

				<button
					type="button"
					className="no-drag group flex h-7 w-full items-center gap-1 rounded-md border border-input bg-background/30 px-2 pr-1 text-xs text-muted-foreground transition-colors hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => setCommandPaletteOpen(true)}
				>
					<Search className="size-3.5 text-muted-foreground" />
					<span className="flex-1 text-left">Search</span>
					<Kbd className="px-2 text-xs text-foreground/70 gap-0.5 items-center">
						<span className="text-sm">{mac ? "⌘" : "Ctrl"}</span>
						{shortcut}
					</Kbd>
				</button>

				<div className="no-drag flex items-center justify-end gap-1">
					<Button
						variant="ghost"
						size="icon"
						className={cn(
							"size-7",
							view === "settings" &&
								"bg-accent/10 text-primary hover:bg-accent/10",
						)}
						onClick={() => setView("settings")}
					>
						<Settings className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</header>
	);
}
