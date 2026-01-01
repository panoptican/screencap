import type {
	AutomationRule,
	AutomationRules,
	PolicyInput,
	PolicyOverrides,
	PolicyResult,
} from "./types";

function mergeRule(base: PolicyResult, rule: AutomationRule): PolicyResult {
	const overrides: PolicyOverrides = { ...base.overrides };

	if (rule.category !== undefined) {
		overrides.category = rule.category;
	}
	if (rule.tags !== undefined) {
		overrides.tags = rule.tags;
	}
	if (rule.projectMode !== undefined) {
		overrides.projectMode = rule.projectMode;
	}
	if (rule.project !== undefined) {
		overrides.project = rule.project;
	}

	return {
		capture: rule.capture ?? base.capture,
		llm: rule.llm ?? base.llm,
		overrides,
	};
}

export function evaluateAutomationPolicy(
	input: PolicyInput,
	rules: AutomationRules | undefined | null,
): PolicyResult {
	let result: PolicyResult = {
		capture: "allow",
		llm: "allow",
		overrides: {},
	};

	if (!rules) {
		return result;
	}

	if (input.appBundleId) {
		const appRule = rules.apps[input.appBundleId];
		if (appRule) {
			result = mergeRule(result, appRule);
		}
	}

	if (input.urlHost) {
		const hostRule = rules.hosts[input.urlHost];
		if (hostRule) {
			result = mergeRule(result, hostRule);
		}
	}

	return result;
}
