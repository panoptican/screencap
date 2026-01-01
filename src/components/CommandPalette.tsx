import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Command } from "cmdk";
import {
	BookOpen,
	Brain,
	Clock,
	Settings,
	Tag,
	Trash2,
	TrendingUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/stores/app";
import type { View } from "@/types";

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const setView = useAppStore((s) => s.setView);
	const selectedEventIds = useAppStore((s) => s.selectedEventIds);
	const clearSelection = useAppStore((s) => s.clearSelection);

	const handleNavigation = (view: View) => {
		setView(view);
		onOpenChange(false);
	};

	const handleDismissSelected = async () => {
		if (selectedEventIds.size > 0) {
			await window.api.storage.dismissEvents(Array.from(selectedEventIds));
			clearSelection();
		}
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="p-0 max-w-lg overflow-hidden border-border"
				aria-describedby={undefined}
			>
				<VisuallyHidden.Root>
					<DialogTitle>Command Palette</DialogTitle>
				</VisuallyHidden.Root>
				<Command className="bg-card rounded-lg">
					<Command.Input
						placeholder="Type a command or search..."
						className="w-full h-12 px-4 text-sm bg-transparent border-b border-border outline-none placeholder:text-muted-foreground"
					/>
					<Command.List className="max-h-80 overflow-y-auto p-2">
						<Command.Empty className="text-center text-sm text-muted-foreground py-6">
							No results found.
						</Command.Empty>

						<Command.Group
							heading=""
							className="text-xs text-muted-foreground px-2 py-1.5"
						>
							<Command.Item
								className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
								onSelect={() => handleNavigation("timeline")}
							>
								<Clock className="h-4 w-4" />
								Go to Timeline
							</Command.Item>
							<Command.Item
								className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
								onSelect={() => handleNavigation("progress")}
							>
								<TrendingUp className="h-4 w-4" />
								Go to Progress
							</Command.Item>
							<Command.Item
								className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
								onSelect={() => handleNavigation("memory")}
							>
								<Brain className="h-4 w-4" />
								Go to Memory
							</Command.Item>
							<Command.Item
								className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
								onSelect={() => handleNavigation("story")}
							>
								<BookOpen className="h-4 w-4" />
								Go to Journal
							</Command.Item>
							<Command.Item
								className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
								onSelect={() => handleNavigation("settings")}
							>
								<Settings className="h-4 w-4" />
								Go to Settings
							</Command.Item>
						</Command.Group>

						{selectedEventIds.size > 0 && (
							<Command.Group
								heading="Actions"
								className="text-xs text-muted-foreground px-2 py-1.5"
							>
								<Command.Item
									className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
									onSelect={handleDismissSelected}
								>
									<Trash2 className="h-4 w-4" />
									Dismiss {selectedEventIds.size} selected
								</Command.Item>
								<Command.Item
									className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted data-[selected=true]:bg-muted"
									onSelect={() => onOpenChange(false)}
								>
									<Tag className="h-4 w-4" />
									Relabel {selectedEventIds.size} selected
								</Command.Item>
							</Command.Group>
						)}
					</Command.List>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
