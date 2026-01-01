import {
	BookOpen,
	Brain,
	Clock,
	Command,
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
	{ id: "memory", icon: Brain, label: "Memory" },
	{ id: "settings", icon: Settings, label: "Settings" },
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
										"bg-primary/20 text-primary hover:bg-primary/30",
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

			<Tooltip delayDuration={100}>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-10 w-10 mb-3"
						onClick={() => setCommandPaletteOpen(true)}
					>
						<Command className="h-5 w-5" />
					</Button>
				</TooltipTrigger>
				<TooltipContent side="right">Command Palette (⌘K)</TooltipContent>
			</Tooltip>
		</aside>
	);
}
