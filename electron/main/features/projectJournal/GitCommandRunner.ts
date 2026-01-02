import { spawn } from "node:child_process";
import { createLogger } from "../../infra/log";

const logger = createLogger({ scope: "GitCommandRunner" });

export type GitRunOptions = {
	cwd: string;
	timeoutMs?: number;
	maxOutputBytes?: number;
};

export class GitCommandError extends Error {
	readonly code: "timeout" | "spawn_failed" | "output_limit" | "non_zero_exit";
	readonly exitCode: number | null;
	readonly stderr: string;

	constructor(options: {
		code: GitCommandError["code"];
		message: string;
		exitCode: number | null;
		stderr: string;
	}) {
		super(options.message);
		this.code = options.code;
		this.exitCode = options.exitCode;
		this.stderr = options.stderr;
	}
}

function concatBuffers(chunks: Buffer[]): Buffer {
	if (chunks.length === 0) return Buffer.alloc(0);
	if (chunks.length === 1) return chunks[0];
	return Buffer.concat(chunks);
}

export async function runGit(
	args: string[],
	options: GitRunOptions,
): Promise<{ stdout: string; stderr: string }> {
	const timeoutMs = options.timeoutMs ?? 15_000;
	const maxOutputBytes = options.maxOutputBytes ?? 5_000_000;

	return await new Promise((resolve, reject) => {
		const child = spawn("git", args, {
			cwd: options.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		let stdoutBytes = 0;
		let stderrBytes = 0;
		let finished = false;

		const finish = (fn: () => void) => {
			if (finished) return;
			finished = true;
			fn();
		};

		const timer = setTimeout(() => {
			try {
				child.kill("SIGKILL");
			} catch {}
			finish(() => {
				reject(
					new GitCommandError({
						code: "timeout",
						message: `git ${args[0] ?? ""} timed out`,
						exitCode: null,
						stderr: concatBuffers(stderrChunks).toString("utf-8"),
					}),
				);
			});
		}, timeoutMs);

		const onChunk = (
			chunks: Buffer[],
			setBytes: (next: number) => void,
			currentBytes: () => number,
			chunk: Buffer,
		) => {
			const next = currentBytes() + chunk.length;
			if (next > maxOutputBytes) {
				try {
					child.kill("SIGKILL");
				} catch {}
				finish(() => {
					clearTimeout(timer);
					reject(
						new GitCommandError({
							code: "output_limit",
							message: `git ${args[0] ?? ""} output limit exceeded`,
							exitCode: null,
							stderr: concatBuffers(stderrChunks).toString("utf-8"),
						}),
					);
				});
				return;
			}
			setBytes(next);
			chunks.push(chunk);
		};

		child.stdout?.on("data", (chunk: Buffer) => {
			onChunk(
				stdoutChunks,
				(v) => {
					stdoutBytes = v;
				},
				() => stdoutBytes,
				chunk,
			);
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			onChunk(
				stderrChunks,
				(v) => {
					stderrBytes = v;
				},
				() => stderrBytes,
				chunk,
			);
		});

		child.on("error", (error) => {
			finish(() => {
				clearTimeout(timer);
				logger.warn("Failed to spawn git", { error: String(error) });
				reject(
					new GitCommandError({
						code: "spawn_failed",
						message: "Failed to spawn git",
						exitCode: null,
						stderr: concatBuffers(stderrChunks).toString("utf-8"),
					}),
				);
			});
		});

		child.on("close", (code) => {
			finish(() => {
				clearTimeout(timer);
				const stdout = concatBuffers(stdoutChunks).toString("utf-8");
				const stderr = concatBuffers(stderrChunks).toString("utf-8");
				if (code !== 0) {
					reject(
						new GitCommandError({
							code: "non_zero_exit",
							message: `git ${args[0] ?? ""} failed`,
							exitCode: code,
							stderr,
						}),
					);
					return;
				}
				resolve({ stdout, stderr });
			});
		});
	});
}
