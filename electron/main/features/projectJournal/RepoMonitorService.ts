import type { ProjectRepo } from "../../../shared/types";
import { listAllProjectRepos } from "../../infra/db/repositories/ProjectRepoRepository";
import {
	closeAllOpenWorkSessions,
	insertRepoWorkSession,
	updateWorkSessionById,
} from "../../infra/db/repositories/RepoWorkSessionRepository";
import { createLogger } from "../../infra/log";
import {
	getCurrentBranch,
	getDirtyFiles,
	getHeadSha,
	getWorkingTreeDiffStat,
} from "./GitService";

const logger = createLogger({ scope: "RepoMonitor" });

const POLL_INTERVAL_MS = 20_000;

type MonitoredRepo = {
	repo: ProjectRepo;
	inFlight: Promise<void> | null;
	session: {
		id: string;
		files: Set<string>;
		maxInsertions: number;
		maxDeletions: number;
	} | null;
};

let timer: NodeJS.Timeout | null = null;
const repos = new Map<string, MonitoredRepo>();

function uniqFiles(files: string[]): string[] {
	return Array.from(new Set(files)).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: "base" }),
	);
}

function closeSession(monitored: MonitoredRepo, now: number): void {
	if (!monitored.session) return;
	updateWorkSessionById(monitored.session.id, {
		endAt: now,
		isOpen: false,
		files: Array.from(monitored.session.files),
		maxInsertions: monitored.session.maxInsertions,
		maxDeletions: monitored.session.maxDeletions,
		updatedAt: now,
	});
	monitored.session = null;
}

async function scanOnce(monitored: MonitoredRepo): Promise<void> {
	const now = Date.now();
	const repoRoot = monitored.repo.repoRoot;

	const files = await getDirtyFiles(repoRoot);
	const dirtyFiles = uniqFiles(files);
	const isDirty = dirtyFiles.length > 0;

	if (!isDirty) {
		closeSession(monitored, now);
		return;
	}

	const [branch, headSha, diff] = await Promise.all([
		getCurrentBranch(repoRoot),
		getHeadSha(repoRoot),
		getWorkingTreeDiffStat(repoRoot),
	]);

	if (!monitored.session) {
		const id = crypto.randomUUID();
		monitored.session = {
			id,
			files: new Set(dirtyFiles),
			maxInsertions: diff.insertions,
			maxDeletions: diff.deletions,
		};
		insertRepoWorkSession({
			id,
			projectRepoId: monitored.repo.id,
			projectKey: monitored.repo.projectKey,
			projectName: monitored.repo.projectName,
			repoRoot: monitored.repo.repoRoot,
			branch,
			headSha,
			startAt: now,
			endAt: now,
			maxInsertions: diff.insertions,
			maxDeletions: diff.deletions,
			files: dirtyFiles,
			updatedAt: now,
		});
		return;
	}

	for (const f of dirtyFiles) monitored.session.files.add(f);
	monitored.session.maxInsertions = Math.max(
		monitored.session.maxInsertions,
		diff.insertions,
	);
	monitored.session.maxDeletions = Math.max(
		monitored.session.maxDeletions,
		diff.deletions,
	);

	updateWorkSessionById(monitored.session.id, {
		endAt: now,
		branch,
		headSha,
		maxInsertions: monitored.session.maxInsertions,
		maxDeletions: monitored.session.maxDeletions,
		files: Array.from(monitored.session.files),
		updatedAt: now,
	});
}

async function poll(): Promise<void> {
	for (const monitored of repos.values()) {
		if (monitored.inFlight) continue;
		monitored.inFlight = scanOnce(monitored)
			.catch((error) => {
				logger.debug("Repo scan failed", {
					repoRoot: monitored.repo.repoRoot,
					error: String(error),
				});
			})
			.finally(() => {
				monitored.inFlight = null;
			});
	}
}

function syncReposFromDb(): void {
	const current = new Map<string, ProjectRepo>();
	for (const r of listAllProjectRepos()) current.set(r.id, r);

	for (const id of Array.from(repos.keys())) {
		if (!current.has(id)) {
			const monitored = repos.get(id);
			if (monitored) closeSession(monitored, Date.now());
			repos.delete(id);
		}
	}

	for (const r of current.values()) {
		if (repos.has(r.id)) continue;
		repos.set(r.id, { repo: r, inFlight: null, session: null });
	}
}

export function startRepoMonitor(): void {
	if (timer) clearInterval(timer);

	closeAllOpenWorkSessions(Date.now());
	syncReposFromDb();

	timer = setInterval(() => {
		void poll();
	}, POLL_INTERVAL_MS);

	void poll();
	logger.info("Repo monitor started", {
		repos: repos.size,
		pollMs: POLL_INTERVAL_MS,
	});
}

export function stopRepoMonitor(): void {
	if (!timer) return;
	clearInterval(timer);
	timer = null;
	for (const monitored of repos.values()) {
		closeSession(monitored, Date.now());
	}
	repos.clear();
	logger.info("Repo monitor stopped");
}

export function refreshRepoMonitor(): void {
	if (!timer) return;
	syncReposFromDb();
}

export function isRepoMonitorRunning(): boolean {
	return timer !== null;
}
