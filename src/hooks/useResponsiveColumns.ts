import { useEffect, useState, type RefObject } from "react";

export function useResponsiveColumns(
	containerRef: RefObject<HTMLElement | null>,
): number {
	const [columns, setColumns] = useState(4);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width >= 1280) setColumns(4);
			else if (width >= 1024) setColumns(3);
			else if (width >= 768) setColumns(2);
			else setColumns(1);
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, [containerRef]);

	return columns;
}
