export interface DbEvent {
	id: string;
	timestamp: number;
	end_timestamp: number | null;
	display_id: string | null;
	category: string | null;
	subcategories: string | null;
	project: string | null;
	project_progress: number;
	project_progress_confidence: number | null;
	project_progress_evidence: string | null;
	potential_progress: number;
	tags: string | null;
	confidence: number | null;
	caption: string | null;
	tracked_addiction: string | null;
	addiction_candidate: string | null;
	addiction_confidence: number | null;
	thumbnail_path: string | null;
	original_path: string | null;
	stable_hash: string | null;
	detail_hash: string | null;
	merged_count: number | null;
	dismissed: number;
	user_label: string | null;
	status: string;
	app_bundle_id: string | null;
	app_name: string | null;
	window_title: string | null;
	url_host: string | null;
	url_canonical: string | null;
	content_kind: string | null;
	content_id: string | null;
	content_title: string | null;
	is_fullscreen: number;
	context_provider: string | null;
	context_confidence: number | null;
	context_key: string | null;
	context_json: string | null;
}

export interface FormattedEvent {
	id: string;
	time: string;
	duration: string | null;
	activity: string;
	category: string;
	project?: string;
	app?: string;
	context?: string;
	isProgress?: boolean;
	url?: string;
}

export interface FormattedTimeSummary {
	period: string;
	totalTime: string;
	breakdown: {
		category: string;
		time: string;
		percent: number;
		eventCount: number;
	}[];
}

export interface FormattedAppUsage {
	app: string;
	time: string;
	eventCount: number;
	percent: number;
}

export interface FormattedWebsiteUsage {
	host: string;
	time: string;
	eventCount: number;
	percent: number;
}

export interface FormattedProject {
	name: string;
	eventCount: number;
	progressCount: number;
	lastActivity: string | null;
	totalTime: string;
}

export interface FormattedProjectStats {
	name: string;
	period: string;
	eventCount: number;
	progressCount: number;
	totalTime: string;
	topApps: string[];
	recentActivity: FormattedEvent[];
}

export interface FocusScore {
	date: string;
	score: number;
	focusTime: string;
	distractionTime: string;
	focusCategories: string[];
	topDistractions: string[];
}

export interface FormattedAddictionStats {
	name: string;
	lastIncidentAt: string | null;
	thisWeekCount: number;
	lastWeekCount: number;
	trend: "increasing" | "decreasing" | "stable";
}

export interface PeriodComparison {
	period1Label: string;
	period2Label: string;
	period1: {
		totalTime: string;
		focusTime: string;
		distractionTime: string;
		eventCount: number;
	};
	period2: {
		totalTime: string;
		focusTime: string;
		distractionTime: string;
		eventCount: number;
	};
	change: {
		focusTimePercent: number;
		distractionTimePercent: number;
		productivityTrend: "improved" | "declined" | "stable";
	};
}

export interface DbMemory {
	id: string;
	type: string;
	content: string;
	description: string | null;
	created_at: number;
	updated_at: number;
}

export interface DbStory {
	id: string;
	period_type: string;
	period_start: number;
	period_end: number;
	content: string;
	created_at: number;
}

export interface DbEodEntry {
	id: string;
	day_start: number;
	day_end: number;
	schema_version: number;
	content: string;
	created_at: number;
	updated_at: number;
	submitted_at: number | null;
}

export interface QueryEventsParams {
	startDate?: number;
	endDate?: number;
	category?: string;
	project?: string;
	app?: string;
	urlHost?: string;
	limit?: number;
	includeImages?: boolean;
}

export interface SearchEventsParams {
	query: string;
	startDate?: number;
	endDate?: number;
	limit?: number;
	includeImages?: boolean;
}
