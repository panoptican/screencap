import { Check, Pencil, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/utils";
import type { Memory } from "@/types";

interface MemoryCardProps {
	memory: Memory;
	onEdit: (
		id: string,
		updates: { content: string; description?: string | null },
	) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	readOnly?: boolean;
	footer?: ReactNode;
}

export function MemoryCard({
	memory,
	onEdit,
	onDelete,
	readOnly,
	footer,
}: MemoryCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [content, setContent] = useState(memory.content);
	const [description, setDescription] = useState(memory.description ?? "");

	const handleSave = async () => {
		if (content.trim()) {
			await onEdit(memory.id, {
				content: content.trim(),
				...(memory.type === "addiction" || memory.type === "project"
					? { description: description.trim() || null }
					: {}),
			});
			setIsEditing(false);
		}
	};

	const handleCancel = () => {
		setContent(memory.content);
		setDescription(memory.description ?? "");
		setIsEditing(false);
	};

	const handleDelete = async () => {
		await onDelete(memory.id);
	};

	return (
		<div className="group p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
			{isEditing ? (
				<div className="space-y-3">
					{memory.type === "addiction" || memory.type === "project" ? (
						<div className="space-y-3">
							<Input
								value={content}
								onChange={(e) => setContent(e.target.value)}
								autoFocus
							/>
							<Textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="min-h-[80px] resize-none"
								placeholder={
									memory.type === "addiction"
										? "About (optional)"
										: "Notes (optional)"
								}
							/>
						</div>
					) : (
						<Textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							className="min-h-[80px] resize-none"
							autoFocus
						/>
					)}
					<div className="flex justify-end gap-2">
						<Button size="sm" variant="ghost" onClick={handleCancel}>
							<X className="h-4 w-4 mr-1" />
							Cancel
						</Button>
						<Button size="sm" onClick={handleSave}>
							<Check className="h-4 w-4 mr-1" />
							Save
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-3">
					<div className="flex items-start gap-3">
						<div className="flex-1">
							{memory.type === "addiction" || memory.type === "project" ? (
								<div className="space-y-1">
									<p className="text-sm font-medium">{memory.content}</p>
									{memory.description && (
										<p className="text-xs text-muted-foreground whitespace-pre-wrap">
											{memory.description}
										</p>
									)}
								</div>
							) : (
								<p className="text-sm">{memory.content}</p>
							)}
							<p className="text-xs text-muted-foreground mt-2">
								{formatRelativeTime(memory.updatedAt)}
							</p>
						</div>
						{!readOnly && (
							<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity -mt-2 -mr-2">
								<Button
									size="icon"
									variant="ghost"
									className="size-6"
									onClick={() => setIsEditing(true)}
								>
									<Pencil className="size-2.5" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									className="size-6 text-destructive hover:text-destructive"
									onClick={handleDelete}
								>
									<Trash2 className="size-2.5" />
								</Button>
							</div>
						)}
					</div>

					{footer}
				</div>
			)}
		</div>
	);
}
