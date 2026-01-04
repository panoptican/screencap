export const DAY_CUTOFF_HOUR = 4;

export function getLogicalDayStart(timestamp: number): number {
	const d = new Date(timestamp);
	const hour = d.getHours();

	if (hour < DAY_CUTOFF_HOUR) {
		d.setDate(d.getDate() - 1);
	}

	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export function getLogicalDayEnd(dayStartMs: number): number {
	return dayStartMs + 24 * 60 * 60 * 1000 - 1;
}
