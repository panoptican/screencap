import { formatDate } from "@/lib/utils";
import type { Story } from "@/types";

interface StoryCardProps {
	story: Story;
}

export function StoryCard({ story }: StoryCardProps) {
	const parts = story.content
		.split("\n")
		.map((p) => p.trim())
		.filter(Boolean);
	const counts = new Map<string, number>();

	return (
		<div className="p-6 rounded-lg border border-border bg-card animate-fade-in">
			<div className="flex items-center justify-between mb-4">
				<span className="text-sm text-muted-foreground">
					{formatDate(story.periodStart)}
					{story.periodType === "weekly" && ` - ${formatDate(story.periodEnd)}`}
				</span>
				<span className="text-xs text-muted-foreground">
					Generated {formatDate(story.createdAt)}
				</span>
			</div>
			<div className="prose prose-invert prose-sm max-w-none">
				{parts.map((paragraph) => {
					const next = (counts.get(paragraph) ?? 0) + 1;
					counts.set(paragraph, next);
					const key = `${story.id}:${next}:${paragraph}`;
					return (
						<p key={key} className="text-foreground/90">
							{paragraph}
						</p>
					);
				})}
			</div>
		</div>
	);
}
