import {
	BookOpen,
	Briefcase,
	Clock,
	Command,
	Flame,
	Settings,
	TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app";
import type { View } from "@/types";

interface NavItem {
	id: View;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}

const navItems: NavItem[] = [
	{ id: "timeline", icon: Clock, label: "Timeline" },
	{ id: "progress", icon: TrendingUp, label: "Progress" },
	{ id: "story", icon: BookOpen, label: "Journal" },
	{ id: "projects", icon: Briefcase, label: "Projects" },
	{ id: "addictions", icon: Flame, label: "Addictions" },
];

export function Sidebar() {
	const view = useAppStore((s) => s.view);
	const setView = useAppStore((s) => s.setView);
	const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);

	return (
		<aside className="relative w-[68px] border-r border-border flex flex-col items-center bg-card/50">
			<div className="h-10 w-full shrink-0 drag-region" />
			<nav className="flex flex-col gap-1 pt-2">
				{navItems.map((item) => (
					<Tooltip key={item.id} delayDuration={100}>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									"h-10 w-10 transition-all duration-200",
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
							className="h-10 w-10"
							onClick={() => setCommandPaletteOpen(true)}
						>
							<Command className="h-5 w-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">Command Palette (⌘K)</TooltipContent>
				</Tooltip>

				<Tooltip delayDuration={100}>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={cn(
								"h-10 w-10 transition-all duration-200",
								view === "settings" &&
									"bg-accent/10 text-primary hover:bg-accent/10",
							)}
							onClick={() => setView("settings")}
						>
							<Settings className="h-5 w-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">Settings</TooltipContent>
				</Tooltip>
			</div>
		</aside>
	);
}
