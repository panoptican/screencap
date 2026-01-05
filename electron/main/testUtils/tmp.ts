import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createTempDir(prefix: string): Promise<{
	dir: string;
	cleanup: () => Promise<void>;
}> {
	const dir = await mkdtemp(join(tmpdir(), prefix));
	return {
		dir,
		cleanup: async () => {
			await rm(dir, { recursive: true, force: true });
		},
	};
}
