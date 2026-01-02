import type { AutomationRule } from "@/types";

export type RuleBehavior =
	| "default"
	| "no_capture"
	| "capture_only"
	| "capture_ai";

export function behaviorFromAutomationRule(rule: AutomationRule): RuleBehavior {
	if (rule.capture === "skip") return "no_capture";
	if (rule.llm === "skip") return "capture_only";
	if (rule.capture === "allow" || rule.llm === "allow") return "capture_ai";
	return "default";
}

export function updatesForBehavior(
	behavior: RuleBehavior,
): Partial<AutomationRule> {
	switch (behavior) {
		case "default":
			return { capture: undefined, llm: undefined };
		case "no_capture":
			return { capture: "skip", llm: undefined };
		case "capture_only":
			return { capture: "allow", llm: "skip" };
		case "capture_ai":
			return { capture: "allow", llm: "allow" };
	}
}

export function normalizeAutomationRule(rule: AutomationRule): AutomationRule {
	const normalized: AutomationRule = {};
	if (rule.capture !== undefined) normalized.capture = rule.capture;
	if (rule.llm !== undefined) normalized.llm = rule.llm;
	if (rule.category !== undefined) normalized.category = rule.category;
	if (rule.tags !== undefined) normalized.tags = rule.tags;
	if (rule.projectMode !== undefined) normalized.projectMode = rule.projectMode;
	if (rule.project !== undefined) normalized.project = rule.project;
	return normalized;
}

export function isEmptyAutomationRule(rule: AutomationRule): boolean {
	return (
		rule.capture === undefined &&
		rule.llm === undefined &&
		rule.category === undefined &&
		rule.tags === undefined &&
		rule.projectMode === undefined &&
		rule.project === undefined
	);
}
