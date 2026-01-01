import { useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/app";

export function usePermission() {
	const hasPermission = useAppStore((s) => s.hasPermission);
	const setHasPermission = useAppStore((s) => s.setHasPermission);

	const checkPermission = useCallback(async () => {
		if (!window.api) return false;
		const result = await window.api.permissions.hasScreenCapture();
		setHasPermission(result);
		return result;
	}, [setHasPermission]);

	const openSettings = useCallback(async () => {
		if (!window.api) return;
		await window.api.permissions.openSettings();
	}, []);

	useEffect(() => {
		if (!window.api) return;

		checkPermission();

		const unsubscribe = window.api.on("permission:required", () => {
			setHasPermission(false);
		});

		return unsubscribe;
	}, [checkPermission, setHasPermission]);

	return { hasPermission, checkPermission, openSettings };
}
