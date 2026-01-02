import { GitCommit as GitCommitIcon } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { GitCommit } from "@/types";

function repoLabel(repoRoot: string): string {
	const parts = repoRoot.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? repoRoot;
}

export function ProgressCommitCard({
	commit,
	isLast = false,
}: {
	commit: GitCommit;
	isLast?: boolean;
}) {
	return (
		<div className="grid grid-cols-[96px,1fr] gap-4">
			<div className="relative">
				<div className="pr-4 pt-1 text-right font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
					{formatTime(commit.timestamp)}
				</div>
				<div className="absolute -right-0.5 top-2 h-2 w-2 rounded-full bg-emerald-500" />
				{!isLast && (
					<div className="absolute right-[2px] top-5 -bottom-7 w-px bg-emerald-500/40" />
				)}
			</div>

			<div className="rounded-xl border border-border bg-card text-left">
				<div className="p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="flex items-start gap-2">
								<GitCommitIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<div className="text-sm font-medium truncate">
										{commit.subject}
									</div>
									<div className="mt-1 text-xs text-muted-foreground truncate">
										{repoLabel(commit.repoRoot)}
										{" · "}
										<span className="font-mono">{commit.sha.slice(0, 7)}</span>
										{" · "}
										{commit.files.length} files
									</div>
								</div>
							</div>
						</div>
						<div className="shrink-0 text-xs text-muted-foreground">
							+{commit.insertions} −{commit.deletions}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
