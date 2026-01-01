import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { getScreenshotsDir } from "../infra/paths";

function isSubpath(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return (
		rel === "" ||
		(!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
	);
}

export function registerProtocols(): void {
	const screenshotsRoot = realpathSync(getScreenshotsDir());

	protocol.handle("local-file", (request) => {
		if (request.method !== "GET") return new Response(null, { status: 405 });

		const rawPath = request.url.replace("local-file://", "");
		const decodedPath = decodeURIComponent(rawPath);
		if (!decodedPath) return new Response(null, { status: 400 });

		const absolutePath = isAbsolute(decodedPath)
			? decodedPath
			: resolve(decodedPath);
		if (!existsSync(absolutePath)) return new Response(null, { status: 404 });

		let realPath: string;
		try {
			realPath = realpathSync(absolutePath);
		} catch {
			return new Response(null, { status: 404 });
		}

		if (!isSubpath(screenshotsRoot, realPath)) {
			return new Response(null, { status: 403 });
		}

		return net.fetch(pathToFileURL(realPath).href);
	});
}
