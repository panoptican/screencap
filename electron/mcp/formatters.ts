import type {
	DbEvent,
	FocusScore,
	FormattedAddictionStats,
	FormattedAppUsage,
	FormattedEvent,
	FormattedProject,
	FormattedTimeSummary,
	FormattedWebsiteUsage,
	PeriodComparison,
} from "./types";

export function formatTime(timestamp: number, includeDate = false): string {
	const date = new Date(timestamp);
	const timeStr = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});

	if (includeDate) {
		const dateStr = date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
		return `${dateStr}, ${timeStr}`;
	}

	return timeStr;
}

export function formatDuration(ms: number): string {
	if (ms < 0) return "0m";

	const hours = Math.floor(ms / (1000 * 60 * 60));
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

	if (hours > 0) {
		return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	}
	return `${minutes}m`;
}

export function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

export function formatDateShort(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function formatEventForLLM(
	event: DbEvent,
	includeDate = false,
): FormattedEvent {
	const duration =
		event.end_timestamp && event.timestamp
			? formatDuration(event.end_timestamp - event.timestamp)
			: null;

	const context = event.url_host || truncateWindowTitle(event.window_title);

	return {
		id: event.id,
		time: formatTime(event.timestamp, includeDate),
		duration,
		activity: event.caption || "Unknown activity",
		category: event.category || "Unknown",
		...(event.project && { project: event.project }),
		...(event.app_name && { app: event.app_name }),
		...(context && { context }),
		...(event.project_progress > 0 && { isProgress: true }),
		...(event.url_canonical && { url: event.url_canonical }),
	};
}

export function formatEventsForLLM(
	events: DbEvent[],
	includeDate = false,
): FormattedEvent[] {
	return events.map((e) => formatEventForLLM(e, includeDate));
}

function truncateWindowTitle(
	title: string | null,
	maxLength = 60,
): string | null {
	if (!title) return null;
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength - 3)}...`;
}

export function formatTimeSummary(
	categoryStats: { category: string; totalMs: number; count: number }[],
	periodLabel: string,
): FormattedTimeSummary {
	const totalMs = categoryStats.reduce((sum, c) => sum + c.totalMs, 0);

	return {
		period: periodLabel,
		totalTime: formatDuration(totalMs),
		breakdown: categoryStats
			.sort((a, b) => b.totalMs - a.totalMs)
			.map((c) => ({
				category: c.category,
				time: formatDuration(c.totalMs),
				percent: totalMs > 0 ? Math.round((c.totalMs / totalMs) * 100) : 0,
				eventCount: c.count,
			})),
	};
}

export function formatAppUsage(
	apps: { app: string; totalMs: number; count: number }[],
	totalMs: number,
): FormattedAppUsage[] {
	return apps.map((a) => ({
		app: a.app,
		time: formatDuration(a.totalMs),
		eventCount: a.count,
		percent: totalMs > 0 ? Math.round((a.totalMs / totalMs) * 100) : 0,
	}));
}

export function formatWebsiteUsage(
	hosts: { host: string; totalMs: number; count: number }[],
	totalMs: number,
): FormattedWebsiteUsage[] {
	return hosts.map((h) => ({
		host: h.host,
		time: formatDuration(h.totalMs),
		eventCount: h.count,
		percent: totalMs > 0 ? Math.round((h.totalMs / totalMs) * 100) : 0,
	}));
}

export function formatProject(
	name: string,
	eventCount: number,
	progressCount: number,
	lastActivityTs: number | null,
	totalMs: number,
): FormattedProject {
	return {
		name,
		eventCount,
		progressCount,
		lastActivity: lastActivityTs ? formatTime(lastActivityTs, true) : null,
		totalTime: formatDuration(totalMs),
	};
}

export function formatFocusScore(
	date: Date,
	focusMs: number,
	distractionMs: number,
	focusCategories: string[],
	topDistractions: { name: string; ms: number }[],
): FocusScore {
	const totalMs = focusMs + distractionMs;
	const score = totalMs > 0 ? Math.round((focusMs / totalMs) * 100) : 0;

	return {
		date: formatDate(date.getTime()),
		score,
		focusTime: formatDuration(focusMs),
		distractionTime: formatDuration(distractionMs),
		focusCategories,
		topDistractions: topDistractions.map(
			(d) => `${d.name} (${formatDuration(d.ms)})`,
		),
	};
}

export function formatAddictionStats(
	name: string,
	lastIncidentAt: number | null,
	thisWeekCount: number,
	lastWeekCount: number,
): FormattedAddictionStats {
	let trend: "increasing" | "decreasing" | "stable" = "stable";
	if (thisWeekCount > lastWeekCount) trend = "increasing";
	else if (thisWeekCount < lastWeekCount) trend = "decreasing";

	return {
		name,
		lastIncidentAt: lastIncidentAt ? formatTime(lastIncidentAt, true) : null,
		thisWeekCount,
		lastWeekCount,
		trend,
	};
}

export function formatPeriodComparison(
	period1Label: string,
	period2Label: string,
	period1Stats: { focusMs: number; distractionMs: number; count: number },
	period2Stats: { focusMs: number; distractionMs: number; count: number },
): PeriodComparison {
	const p1Total = period1Stats.focusMs + period1Stats.distractionMs;
	const p2Total = period2Stats.focusMs + period2Stats.distractionMs;

	const focusChange =
		period2Stats.focusMs > 0
			? Math.round(
					((period1Stats.focusMs - period2Stats.focusMs) /
						period2Stats.focusMs) *
						100,
				)
			: 0;

	const distractionChange =
		period2Stats.distractionMs > 0
			? Math.round(
					((period1Stats.distractionMs - period2Stats.distractionMs) /
						period2Stats.distractionMs) *
						100,
				)
			: 0;

	let productivityTrend: "improved" | "declined" | "stable" = "stable";
	if (focusChange > 10 || distractionChange < -10)
		productivityTrend = "improved";
	else if (focusChange < -10 || distractionChange > 10)
		productivityTrend = "declined";

	return {
		period1Label,
		period2Label,
		period1: {
			totalTime: formatDuration(p1Total),
			focusTime: formatDuration(period1Stats.focusMs),
			distractionTime: formatDuration(period1Stats.distractionMs),
			eventCount: period1Stats.count,
		},
		period2: {
			totalTime: formatDuration(p2Total),
			focusTime: formatDuration(period2Stats.focusMs),
			distractionTime: formatDuration(period2Stats.distractionMs),
			eventCount: period2Stats.count,
		},
		change: {
			focusTimePercent: focusChange,
			distractionTimePercent: distractionChange,
			productivityTrend,
		},
	};
}

export function formatMarkdownEventList(events: FormattedEvent[]): string {
	if (events.length === 0) return "No events found.";

	return events
		.map((e) => {
			const parts = [`- **${e.time}**`];
			if (e.duration) parts.push(`(${e.duration})`);
			parts.push(`- ${e.activity}`);
			if (e.project) parts.push(`[${e.project}]`);
			if (e.app) parts.push(`(${e.app})`);
			return parts.join(" ");
		})
		.join("\n");
}

export function formatMarkdownTimeSummary(
	summary: FormattedTimeSummary,
): string {
	const lines = [`**${summary.period}** - Total: ${summary.totalTime}\n`];

	for (const item of summary.breakdown) {
		lines.push(
			`- ${item.category}: ${item.time} (${item.percent}%) - ${item.eventCount} events`,
		);
	}

	return lines.join("\n");
}
