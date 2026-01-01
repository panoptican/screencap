import type {
	AutomationCapturePolicy,
	AutomationCategory,
	AutomationLlmPolicy,
	AutomationProjectMode,
	AutomationRule,
	AutomationRules,
} from "../../../shared/types";

export type {
	AutomationRule,
	AutomationRules,
	AutomationCapturePolicy,
	AutomationLlmPolicy,
	AutomationCategory,
	AutomationProjectMode,
};

export interface PolicyInput {
	appBundleId?: string | null;
	urlHost?: string | null;
}

export interface PolicyOverrides {
	category?: AutomationCategory;
	tags?: string[];
	projectMode?: AutomationProjectMode;
	project?: string;
}

export interface PolicyResult {
	capture: AutomationCapturePolicy;
	llm: AutomationLlmPolicy;
	overrides: PolicyOverrides;
}
