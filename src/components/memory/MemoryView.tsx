import { Briefcase, Flame, History, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemories } from "@/hooks/useMemories";
import type { Memory } from "@/types";
import { AddMemoryDialog } from "./AddMemoryDialog";
import { MemoryCard } from "./MemoryCard";

export function MemoryView() {
	const {
		addictions,
		projects,
		preferences,
		corrections,
		createMemory,
		editMemory,
		deleteMemory,
	} = useMemories();
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [addType, setAddType] = useState<Memory["type"]>("addiction");

	const handleAdd = (type: Memory["type"]) => {
		setAddType(type);
		setAddDialogOpen(true);
	};

	const handleCreate = async (data: {
		content: string;
		description?: string | null;
	}) => {
		await createMemory(addType, data.content, data.description);
		setAddDialogOpen(false);
	};

	return (
		<div className="h-full flex flex-col">
			<div className="drag-region flex flex-col border-b border-border p-2 px-4">
				<h1 className="text-lg font-semibold">Memory</h1>
				<p className="text-sm text-muted-foreground">
					Teach the AI about your habits, projects, and preferences
				</p>
			</div>

			<Tabs defaultValue="addictions" className="flex-1 flex flex-col">
				<div className="border-b border-border px-4">
					<TabsList className="h-12 bg-transparent p-0 gap-4">
						<TabsTrigger
							value="addictions"
							className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0"
						>
							<Flame className="h-4 w-4 mr-2" />
							Addictions
							{addictions.length > 0 && (
								<span className="ml-2 text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">
									{addictions.length}
								</span>
							)}
						</TabsTrigger>
						<TabsTrigger
							value="projects"
							className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0"
						>
							<Briefcase className="h-4 w-4 mr-2" />
							Projects
						</TabsTrigger>
						<TabsTrigger
							value="preferences"
							className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0"
						>
							<Settings2 className="h-4 w-4 mr-2" />
							Preferences
						</TabsTrigger>
						<TabsTrigger
							value="corrections"
							className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0"
						>
							<History className="h-4 w-4 mr-2" />
							Corrections
						</TabsTrigger>
					</TabsList>
				</div>

				<ScrollArea className="flex-1">
					<TabsContent value="addictions" className="p-6 m-0">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h2 className="text-lg font-medium">Tracked Addictions</h2>
								<p className="text-sm text-muted-foreground">
									Activities you want to monitor and reduce
								</p>
							</div>
							<Button onClick={() => handleAdd("addiction")} size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Add Addiction
							</Button>
						</div>
						<div className="flex flex-col gap-2 md:grid lg:grid-cols-2 lg:gap-4">
							{addictions.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No addictions tracked yet</p>
									<p className="text-sm">
										Add things like "chess", "social media", "YouTube"
									</p>
								</div>
							) : (
								addictions.map((memory) => (
									<MemoryCard
										key={memory.id}
										memory={memory}
										onEdit={editMemory}
										onDelete={deleteMemory}
									/>
								))
							)}
						</div>
					</TabsContent>

					<TabsContent value="projects" className="p-6 m-0">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h2 className="text-lg font-medium">Active Projects</h2>
								<p className="text-sm text-muted-foreground">
									Define your projects and their associated apps
								</p>
							</div>
							<Button onClick={() => handleAdd("project")} size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Add Project
							</Button>
						</div>
						<div className="flex flex-col gap-2 md:grid lg:grid-cols-2 lg:gap-4">
							{projects.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No projects defined yet</p>
									<p className="text-sm">
										E.g., "Thesis: Overleaf, Zotero, Papers"
									</p>
								</div>
							) : (
								projects.map((memory) => (
									<MemoryCard
										key={memory.id}
										memory={memory}
										onEdit={editMemory}
										onDelete={deleteMemory}
									/>
								))
							)}
						</div>
					</TabsContent>

					<TabsContent value="preferences" className="p-6 m-0">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h2 className="text-lg font-medium">Preferences</h2>
								<p className="text-sm text-muted-foreground">
									Classification hints and special instructions
								</p>
							</div>
							<Button onClick={() => handleAdd("preference")} size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Add Preference
							</Button>
						</div>
						<div className="flex flex-col gap-2 md:grid lg:grid-cols-2 lg:gap-4">
							{preferences.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No preferences set yet</p>
									<p className="text-sm">
										E.g., "Studying includes: Coursera, Anki"
									</p>
								</div>
							) : (
								preferences.map((memory) => (
									<MemoryCard
										key={memory.id}
										memory={memory}
										onEdit={editMemory}
										onDelete={deleteMemory}
									/>
								))
							)}
						</div>
					</TabsContent>

					<TabsContent value="corrections" className="p-6 m-0">
						<div className="mb-4">
							<h2 className="text-lg font-medium">Correction History</h2>
							<p className="text-sm text-muted-foreground">
								Past relabels that help improve classification
							</p>
						</div>
						<div className="flex flex-col gap-2 md:grid lg:grid-cols-2 lg:gap-4">
							{corrections.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									<History className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No corrections yet</p>
									<p className="text-sm">
										Corrections are created when you relabel events
									</p>
								</div>
							) : (
								corrections.map((memory) => (
									<MemoryCard
										key={memory.id}
										memory={memory}
										onEdit={editMemory}
										onDelete={deleteMemory}
										readOnly
									/>
								))
							)}
						</div>
					</TabsContent>
				</ScrollArea>
			</Tabs>

			<AddMemoryDialog
				open={addDialogOpen}
				onOpenChange={setAddDialogOpen}
				type={addType}
				onSubmit={handleCreate}
			/>
		</div>
	);
}
