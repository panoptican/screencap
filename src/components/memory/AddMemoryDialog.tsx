import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Memory } from "@/types";

interface AddMemoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	type: Memory["type"];
	onSubmit: (data: {
		content: string;
		description?: string | null;
	}) => Promise<void>;
}

const TYPE_CONFIG = {
	addiction: {
		title: "Add Addiction",
		description: "What activity do you want to track and reduce?",
		namePlaceholder: 'e.g., "Chess"',
		aboutPlaceholder:
			'e.g., "chess.com, lichess.org, puzzles, rapid/blitz. Ignore when I only read chess news/articles."',
	},
	project: {
		title: "Add Project",
		description: "Define a project and its associated tools/apps",
		placeholder:
			'e.g., "My Thesis project: I use Overleaf, Zotero, and Google Scholar for research"',
	},
	preference: {
		title: "Add Preference",
		description: "Add a classification hint or special instruction",
		placeholder:
			'e.g., "When I\'m on Coursera or Udemy, classify as Study even if it looks like videos"',
	},
	correction: {
		title: "Add Correction",
		description: "Add a correction example",
		placeholder:
			'e.g., "VS Code with terminal open should be Work, not Leisure"',
	},
};

export function AddMemoryDialog({
	open,
	onOpenChange,
	type,
	onSubmit,
}: AddMemoryDialogProps) {
	const [content, setContent] = useState("");
	const [description, setDescription] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const config = TYPE_CONFIG[type];

	const handleSubmit = async () => {
		if (!content.trim()) return;

		setIsSubmitting(true);
		try {
			await onSubmit({
				content: content.trim(),
				description: description.trim() || null,
			});
			setContent("");
			setDescription("");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{config.title}</DialogTitle>
					<p className="text-sm text-muted-foreground">{config.description}</p>
				</DialogHeader>

				{type === "addiction" ? (
					<div className="space-y-3">
						<Input
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder={TYPE_CONFIG.addiction.namePlaceholder}
							autoFocus
						/>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={TYPE_CONFIG.addiction.aboutPlaceholder}
							className="min-h-[100px]"
						/>
					</div>
				) : (
					<Textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder={TYPE_CONFIG[type].placeholder}
						className="min-h-[100px]"
						autoFocus
					/>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!content.trim() || isSubmitting}
					>
						{isSubmitting ? "Adding..." : "Add"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
