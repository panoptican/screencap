import { FolderOpen, GitBranch, Link2, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectRepo } from "@/types";

function repoLabel(repoRoot: string): string {
	const parts = repoRoot.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? repoRoot;
}

export function ProjectRepoManager({
	projectName,
	defaultOpen = false,
}: {
	projectName: string;
	defaultOpen?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [repoPath, setRepoPath] = useState("");
	const [state, setState] = useState<{
		repos: ProjectRepo[];
		isLoading: boolean;
		error: string | null;
	}>({ repos: [], isLoading: false, error: null });

	const refresh = useCallback(async () => {
		if (!window.api) return;
		setState((s) => ({ ...s, isLoading: true, error: null }));
		try {
			const repos = await window.api.projectJournal.listRepos(projectName);
			setState({ repos, isLoading: false, error: null });
		} catch (error) {
			setState((s) => ({ ...s, isLoading: false, error: String(error) }));
		}
	}, [projectName]);

	useEffect(() => {
		if (!isOpen) return;
		void refresh();
	}, [isOpen, refresh]);

	const attach = useCallback(
		async (path: string) => {
			if (!window.api) return;
			const trimmed = path.trim();
			if (!trimmed) return;
			setState((s) => ({ ...s, isLoading: true, error: null }));
			try {
				await window.api.projectJournal.attachRepo(projectName, trimmed);
				setRepoPath("");
				await refresh();
			} catch (error) {
				setState((s) => ({ ...s, isLoading: false, error: String(error) }));
			}
		},
		[projectName, refresh],
	);

	const pickAndAttach = useCallback(async () => {
		if (!window.api) return;
		const picked = await window.api.app.pickDirectory();
		if (!picked) return;
		await attach(picked);
	}, [attach]);

	const detach = useCallback(
		async (repoId: string) => {
			if (!window.api) return;
			setState((s) => ({ ...s, isLoading: true, error: null }));
			try {
				await window.api.projectJournal.detachRepo(repoId);
				await refresh();
			} catch (error) {
				setState((s) => ({ ...s, isLoading: false, error: String(error) }));
			}
		},
		[refresh],
	);

	const countLabel = useMemo(() => {
		if (state.repos.length === 0) return "No repos linked";
		if (state.repos.length === 1) return "1 repo linked";
		return `${state.repos.length} repos linked`;
	}, [state.repos.length]);

	return (
		<div className="rounded-md border border-border bg-muted/20">
			<button
				type="button"
				className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
				onClick={() => setIsOpen((v) => !v)}
			>
				<div className="flex items-center gap-2 min-w-0">
					<GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
					<div className="min-w-0">
						<div className="text-sm font-medium">Git repo</div>
						<div className="text-xs text-muted-foreground">{countLabel}</div>
					</div>
				</div>
				<Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
			</button>

			{isOpen ? (
				<div className="border-t border-border px-3 py-3 space-y-3">
					<div className="text-xs text-muted-foreground">
						Link a local repo to show commits in Project progress for this
						project.
					</div>

					<div className="flex gap-2">
						<Input
							value={repoPath}
							onChange={(e) => setRepoPath(e.target.value)}
							placeholder="Paste repo folder path…"
							disabled={!window.api || state.isLoading}
						/>
						<Button
							variant="outline"
							onClick={pickAndAttach}
							disabled={!window.api || state.isLoading}
						>
							<FolderOpen className="h-4 w-4" />
						</Button>
						<Button
							onClick={() => attach(repoPath)}
							disabled={!window.api || state.isLoading || !repoPath.trim()}
						>
							Attach
						</Button>
					</div>

					{state.error ? (
						<div className="text-sm text-destructive">{state.error}</div>
					) : null}

					{state.isLoading ? (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-3 w-3 animate-spin" />
							Loading…
						</div>
					) : null}

					<div className="space-y-2">
						{state.repos.map((r) => (
							<div
								key={r.id}
								className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
							>
								<div className="min-w-0">
									<div className="text-sm font-medium truncate">
										{repoLabel(r.repoRoot)}
									</div>
									<div className="text-xs text-muted-foreground truncate">
										{r.repoRoot}
									</div>
								</div>
								<Button
									size="icon"
									variant="ghost"
									className="shrink-0 text-destructive hover:text-destructive"
									onClick={() => detach(r.id)}
									disabled={state.isLoading}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
