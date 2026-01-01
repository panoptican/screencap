import { Check, Tag, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/stores/app";

export function BulkActions() {
	const selectedEventIds = useAppStore((s) => s.selectedEventIds);
	const clearSelection = useAppStore((s) => s.clearSelection);
	const removeEvent = useAppStore((s) => s.removeEvent);
	const [isRelabeling, setIsRelabeling] = useState(false);
	const [label, setLabel] = useState("");

	const handleDismiss = useCallback(async () => {
		const ids = Array.from(selectedEventIds);
		await window.api.storage.dismissEvents(ids);
		for (const id of ids) removeEvent(id);
		clearSelection();
	}, [clearSelection, removeEvent, selectedEventIds]);

	const handleRelabel = useCallback(async () => {
		if (label.trim()) {
			await window.api.storage.relabelEvents(
				Array.from(selectedEventIds),
				label.trim(),
			);
			setLabel("");
			setIsRelabeling(false);
			clearSelection();
		}
	}, [clearSelection, label, selectedEventIds]);

	return (
		<div className="border-b border-border bg-primary/5 px-4 py-3 flex items-center gap-4">
			<span className="text-sm font-medium">
				{selectedEventIds.size} selected
			</span>

			{isRelabeling ? (
				<div className="flex gap-2 flex-1 max-w-md">
					<Input
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						placeholder="Enter new label..."
						className="h-8"
						autoFocus
						onKeyDown={(e) => e.key === "Enter" && handleRelabel()}
					/>
					<Button size="sm" variant="secondary" onClick={handleRelabel}>
						<Check className="h-4 w-4" />
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => setIsRelabeling(false)}
					>
						Cancel
					</Button>
				</div>
			) : (
				<>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => setIsRelabeling(true)}
					>
						<Tag className="h-4 w-4 mr-2" />
						Relabel
					</Button>
					<Button size="sm" variant="secondary" onClick={handleDismiss}>
						<Trash2 className="h-4 w-4 mr-2" />
						Dismiss
					</Button>
				</>
			)}

			<div className="flex-1" />

			<Button size="sm" variant="ghost" onClick={clearSelection}>
				<X className="h-4 w-4 mr-2" />
				Clear Selection
			</Button>
		</div>
	);
}
