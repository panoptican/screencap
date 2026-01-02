import type React from "react";
import { useEffect } from "react";

function elementContentHeight(el: HTMLElement): number {
	return Math.ceil(el.scrollHeight + (el.offsetHeight - el.clientHeight));
}

export function usePopupAutoHeight(
	rootRef: React.RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		const api = window.api?.popup?.setHeight;
		if (!api) return;
		const el = rootRef.current;
		if (!el) return;

		let frame: number | null = null;

		const update = () => {
			if (frame !== null) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				void api(elementContentHeight(el));
			});
		};

		update();
		const ro = new ResizeObserver(() => update());
		ro.observe(el);
		return () => {
			if (frame !== null) cancelAnimationFrame(frame);
			ro.disconnect();
		};
	}, [rootRef]);
}
