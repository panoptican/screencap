import { Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import { appNavItems } from "./navigation";

export function Sidebar() {
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

	return (
		<aside className="relative px-2 shrink-0 flex flex-col items-center bg-card/50">
			<nav className="flex flex-col gap-1 pt-1">
				{appNavItems.map((item) => (
					<Tooltip key={item.id} delayDuration={100}>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									"w-8 h-8 transition-all duration-200",
									view === item.id &&
										"bg-accent/10 text-primary hover:bg-accent/10",
								)}
								onClick={() => setView(item.id)}
							>
								<item.icon className="h-5 w-5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">{item.label}</TooltipContent>
					</Tooltip>
				))}
			</nav>

			<div className="flex-1" />

			<div className="flex flex-col gap-1 pb-3">
				<Tooltip delayDuration={100}>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="w-8 h-8"
							onClick={() => setCommandPaletteOpen(true)}
						>
							<Command className="h-5 w-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">Command Palette (⌘K)</TooltipContent>
				</Tooltip>
			</div>
		</aside>
	);
}
