import type {
	GitCommit,
	ProjectRepo,
	RepoWorkSession,
} from "../../../shared/types";
import { callOpenRouterRaw } from "../llm/OpenRouterClient";

function formatHm(timestamp: number): string {
	const d = new Date(timestamp);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

function repoLabel(repoRoot: string): string {
	const parts = repoRoot.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? repoRoot;
}

function buildSystemPrompt(): string {
	return `You are a senior engineer writing a project journal from FACTS only.

Rules:
- Never invent code changes, behavior, or features that are not explicitly supported by the provided data.
- Do not reference any code content (you were not given code).
- Prefer concise bullets. No marketing tone.
- If information is insufficient, say "unknown".

Output:
- Plain text only.
- Short sections with ASCII headings.
- Max 20 bullets total.`;
}

function buildUserPayload(options: {
	projectName: string;
	repos: ProjectRepo[];
	commits: GitCommit[];
	sessions: RepoWorkSession[];
}): string {
	const commits = options.commits.slice(0, 200).map((c) => ({
		time: formatHm(c.timestamp),
		repo: repoLabel(c.repoRoot),
		sha: c.sha.slice(0, 7),
		subject: c.subject,
		insertions: c.insertions,
		deletions: c.deletions,
		files: c.files.slice(0, 50),
	}));

	const sessions = options.sessions.slice(0, 200).map((s) => ({
		start: formatHm(s.startAt),
		end: formatHm(s.endAt),
		repo: repoLabel(s.repoRoot),
		maxInsertions: s.maxInsertions,
		maxDeletions: s.maxDeletions,
		files: s.files.slice(0, 50),
	}));

	const repos = options.repos.map((r) => ({
		name: repoLabel(r.repoRoot),
		root: r.repoRoot,
	}));

	return JSON.stringify(
		{
			project: options.projectName,
			repos,
			commits,
			sessions,
		},
		null,
		2,
	);
}

export async function generateProjectJournalSummary(options: {
	projectName: string;
	repos: ProjectRepo[];
	commits: GitCommit[];
	sessions: RepoWorkSession[];
}): Promise<string> {
	const content = await callOpenRouterRaw([
		{ role: "system", content: buildSystemPrompt() },
		{
			role: "user",
			content: buildUserPayload(options),
		},
	]);

	return content || "Unable to generate summary.";
}
