import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
		description: "A single project name (used for tracking and journaling)",
		namePlaceholder: 'e.g., "Screencap"',
		aboutPlaceholder:
			"Optional. Add notes like repo name(s), stack, goals, or how to recognize it.",
	},
	preference: {
		title: "Add Preference",
		description: "Add a classification hint or special instruction",
		placeholder:
			'e.g., "When I\'m on Coursera or Udemy, classify as Study even if it looks like videos"',
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
					<DialogDescription>{config.description}</DialogDescription>
				</DialogHeader>

				{type === "addiction" || type === "project" ? (
					<div className="space-y-3">
						<Input
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder={
								type === "addiction"
									? TYPE_CONFIG.addiction.namePlaceholder
									: TYPE_CONFIG.project.namePlaceholder
							}
							autoFocus
						/>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={
								type === "addiction"
									? TYPE_CONFIG.addiction.aboutPlaceholder
									: TYPE_CONFIG.project.aboutPlaceholder
							}
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
