import type { GitCommit } from "../../../shared/types";
import { runGit } from "./GitCommandRunner";

type GitCommitBase = Omit<GitCommit, "projectRepoId">;

function unixArg(ms: number): string {
	const s = Math.floor(ms / 1000);
	return `@${s}`;
}

function safeTrim(value: string): string {
	return value.replace(/\s+$/g, "");
}

function parsePorcelainZ(output: string): string[] {
	const tokens = output.split("\0").filter(Boolean);
	const files: string[] = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.length < 4) continue;
		const status = token.slice(0, 2);
		const path = token.slice(3);

		const isRenameOrCopy = status[0] === "R" || status[0] === "C";

		if (isRenameOrCopy) {
			const next = tokens[i + 1];
			if (next) {
				files.push(next);
				i += 1;
			} else if (path) {
				files.push(path);
			}
			continue;
		}

		if (path) files.push(path);
	}

	return Array.from(new Set(files));
}

function parseShortStat(output: string): {
	insertions: number;
	deletions: number;
} {
	const t = output.trim();
	if (!t) return { insertions: 0, deletions: 0 };

	const insertionsMatch = t.match(/(\d+)\s+insertions?\(\+\)/);
	const deletionsMatch = t.match(/(\d+)\s+deletions?\(-\)/);

	const insertions = insertionsMatch ? Number(insertionsMatch[1]) : 0;
	const deletions = deletionsMatch ? Number(deletionsMatch[1]) : 0;

	return { insertions, deletions };
}

function parseGitLogNumstat(output: string, repoRoot: string): GitCommitBase[] {
	const records = output.split("\x1e").map((r) => r.trim());

	const commits: GitCommitBase[] = [];

	for (const record of records) {
		if (!record) continue;
		const lines = record.split("\n");
		const header = lines[0]?.trim() ?? "";
		const [sha, ts, subject, parentsRaw] = header.split("\x1f");
		const timestamp = Number(ts);
		const parents = parentsRaw
			? parentsRaw
					.split(" ")
					.map((p) => p.trim())
					.filter(Boolean)
			: [];

		let insertions = 0;
		let deletions = 0;
		const files: string[] = [];

		for (const line of lines.slice(1)) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const parts = trimmed.split("\t");
			if (parts.length < 3) continue;
			const [a, d, file] = parts;
			if (a !== "-" && a) insertions += Number(a) || 0;
			if (d !== "-" && d) deletions += Number(d) || 0;
			if (file) files.push(file.trim());
		}

		if (!sha || !Number.isFinite(timestamp) || !subject) continue;

		commits.push({
			repoRoot,
			sha,
			timestamp: timestamp * 1000,
			subject: safeTrim(subject),
			parents,
			insertions,
			deletions,
			files: Array.from(new Set(files)),
		});
	}

	return commits;
}

export async function resolveRepoRoot(
	path: string,
): Promise<{ ok: true; repoRoot: string } | { ok: false }> {
	try {
		const { stdout } = await runGit(["rev-parse", "--show-toplevel"], {
			cwd: path,
			timeoutMs: 5000,
			maxOutputBytes: 200_000,
		});
		const repoRoot = stdout.trim();
		if (!repoRoot) return { ok: false };
		return { ok: true, repoRoot };
	} catch {
		return { ok: false };
	}
}

export async function getHeadSha(repoRoot: string): Promise<string | null> {
	try {
		const { stdout } = await runGit(["rev-parse", "HEAD"], {
			cwd: repoRoot,
			timeoutMs: 5000,
			maxOutputBytes: 200_000,
		});
		const sha = stdout.trim();
		return sha ? sha : null;
	} catch {
		return null;
	}
}

export async function getCurrentBranch(
	repoRoot: string,
): Promise<string | null> {
	try {
		const { stdout } = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
			cwd: repoRoot,
			timeoutMs: 5000,
			maxOutputBytes: 200_000,
		});
		const branch = stdout.trim();
		if (!branch || branch === "HEAD") return null;
		return branch;
	} catch {
		return null;
	}
}

export async function getDirtyFiles(repoRoot: string): Promise<string[]> {
	try {
		const { stdout } = await runGit(["status", "--porcelain=v1", "-z"], {
			cwd: repoRoot,
			timeoutMs: 8000,
			maxOutputBytes: 5_000_000,
		});
		return parsePorcelainZ(stdout);
	} catch {
		return [];
	}
}

export async function getWorkingTreeDiffStat(repoRoot: string): Promise<{
	insertions: number;
	deletions: number;
}> {
	const [unstaged, staged] = await Promise.all([
		runGit(["diff", "--shortstat"], {
			cwd: repoRoot,
			timeoutMs: 10_000,
			maxOutputBytes: 200_000,
		}).catch(() => ({ stdout: "" })),
		runGit(["diff", "--cached", "--shortstat"], {
			cwd: repoRoot,
			timeoutMs: 10_000,
			maxOutputBytes: 200_000,
		}).catch(() => ({ stdout: "" })),
	]);

	const a = parseShortStat(unstaged.stdout);
	const b = parseShortStat(staged.stdout);
	return {
		insertions: a.insertions + b.insertions,
		deletions: a.deletions + b.deletions,
	};
}

export async function listCommitsInRange(options: {
	repoRoot: string;
	startAt: number;
	endAt: number;
	limit?: number;
}): Promise<GitCommitBase[]> {
	const args = [
		"log",
		`--since=${unixArg(options.startAt)}`,
		`--until=${unixArg(options.endAt)}`,
		"--no-color",
		"--pretty=format:%x1e%H%x1f%ct%x1f%s%x1f%P%n",
		"--numstat",
	];
	if (options.limit) {
		args.splice(1, 0, `--max-count=${options.limit}`);
	}

	const { stdout } = await runGit(args, {
		cwd: options.repoRoot,
		timeoutMs: 20_000,
		maxOutputBytes: 20_000_000,
	});

	return parseGitLogNumstat(stdout, options.repoRoot);
}
