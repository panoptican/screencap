import { Flame, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAddictionStats } from "@/hooks/useAddictionStats";
import { useMemories } from "@/hooks/useMemories";
import { useAppStore } from "@/stores/app";
import type { Memory } from "@/types";
import { AddictionCard } from "./AddictionCard";
import { AddictionDetailView } from "./AddictionDetailView";
import { AddMemoryDialog } from "./AddMemoryDialog";

export function AddictionsView() {
	const { addictions, createMemory, editMemory, deleteMemory } = useMemories();
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const focusedAddictionId = useAppStore((s) => s.focusedAddictionId);
	const setFocusedAddictionId = useAppStore((s) => s.setFocusedAddictionId);

	useEffect(() => {
		return () => setFocusedAddictionId(null);
	}, [setFocusedAddictionId]);

	useEffect(() => {
		if (!focusedAddictionId) return;
		const found = addictions.find((a) => a.id === focusedAddictionId);
		if (!found) return;
		setSelectedAddiction(found);
		setFocusedAddictionId(null);
	}, [addictions, focusedAddictionId, setFocusedAddictionId]);

	const [selectedAddiction, setSelectedAddiction] = useState<Memory | null>(
		null,
	);

	const addictionNames = useMemo(
		() => addictions.map((a) => a.content),
		[addictions],
	);
	const { stats } = useAddictionStats(addictionNames);

	const handleCreate = useCallback(
		async (data: { content: string; description?: string | null }) => {
			await createMemory("addiction", data.content, data.description);
			setAddDialogOpen(false);
		},
		[createMemory],
	);

	const handleAddictionClick = useCallback((addiction: Memory) => {
		setSelectedAddiction(addiction);
	}, []);

	const handleBack = useCallback(() => {
		setSelectedAddiction(null);
	}, []);

	const handleEdit = useCallback(
		async (
			id: string,
			updates: { content: string; description?: string | null },
		) => {
			await editMemory(id, updates);
			const updated = addictions.find((a) => a.id === id);
			if (updated) {
				setSelectedAddiction({
					...updated,
					content: updates.content,
					description: updates.description,
					updatedAt: Date.now(),
				});
			}
		},
		[addictions, editMemory],
	);

	if (selectedAddiction) {
		return (
			<AddictionDetailView
				addiction={selectedAddiction}
				stats={stats[selectedAddiction.content]}
				onBack={handleBack}
				onEdit={handleEdit}
				onDelete={deleteMemory}
			/>
		);
	}

	return (
		<div className="h-full flex flex-col">
			<div className="drag-region flex border-b border-border p-2 px-4 justify-between items-center">
				<div className="flex flex-col">
					<h1 className="text-lg font-semibold">Addictions</h1>
					<p className="text-sm text-muted-foreground">
						Activities you want to monitor and reduce
					</p>
				</div>

				<div className="flex items-center gap-2 no-drag pt-2">
					<Button onClick={() => setAddDialogOpen(true)} size="sm">
						<Plus className="size-3.5" />
						Track new addiction
					</Button>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-6">
					{addictions.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>No addictions tracked yet</p>
							<p className="text-sm">
								Add things like "chess", "social media", "YouTube"
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{addictions.map((addiction) => (
								<AddictionCard
									key={addiction.id}
									addiction={addiction}
									stats={stats[addiction.content]}
									onClick={() => handleAddictionClick(addiction)}
								/>
							))}
						</div>
					)}
				</div>
			</ScrollArea>

			<AddMemoryDialog
				open={addDialogOpen}
				onOpenChange={setAddDialogOpen}
				type="addiction"
				onSubmit={handleCreate}
			/>
		</div>
	);
}
