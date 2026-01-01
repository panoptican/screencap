export async function copyBestImage(
	paths: Array<string | null | undefined>,
): Promise<boolean> {
	const api = window.api;
	if (!api?.app?.copyImage) return false;

	for (const p of paths) {
		if (!p) continue;
		try {
			const ok = await api.app.copyImage(p);
			if (ok) return true;
		} catch {}
	}

	return false;
}
