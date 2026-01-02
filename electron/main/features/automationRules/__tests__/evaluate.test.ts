import { describe, expect, it } from "vitest";
import { evaluateAutomationPolicy } from "../evaluate";
import type { AutomationRules } from "../types";

describe("evaluateAutomationPolicy", () => {
	it("returns defaults when rules are undefined", () => {
		const result = evaluateAutomationPolicy(
			{ appBundleId: "com.test.app" },
			undefined,
		);
		expect(result).toEqual({
			capture: "allow",
			llm: "allow",
			overrides: {},
		});
	});

	it("returns defaults when rules are null", () => {
		const result = evaluateAutomationPolicy(
			{ appBundleId: "com.test.app" },
			null,
		);
		expect(result).toEqual({
			capture: "allow",
			llm: "allow",
			overrides: {},
		});
	});

	it("returns defaults when no matching rules exist", () => {
		const rules: AutomationRules = { apps: {}, hosts: {} };
		const result = evaluateAutomationPolicy(
			{ appBundleId: "com.test.app" },
			rules,
		);
		expect(result).toEqual({
			capture: "allow",
			llm: "allow",
			overrides: {},
		});
	});

	it("applies app rule when appBundleId matches", () => {
		const rules: AutomationRules = {
			apps: {
				"com.test.app": { capture: "skip", llm: "skip" },
			},
			hosts: {},
		};
		const result = evaluateAutomationPolicy(
			{ appBundleId: "com.test.app" },
			rules,
		);
		expect(result.capture).toBe("skip");
		expect(result.llm).toBe("skip");
	});

	it("applies host rule when urlHost matches", () => {
		const rules: AutomationRules = {
			apps: {},
			hosts: {
				"youtube.com": { llm: "skip", category: "Leisure" },
			},
		};
		const result = evaluateAutomationPolicy({ urlHost: "youtube.com" }, rules);
		expect(result.llm).toBe("skip");
		expect(result.overrides.category).toBe("Leisure");
	});

	it("defaults porn-like websites to Leisure even without rules", () => {
		const result = evaluateAutomationPolicy({ urlHost: "pornhub.com" }, null);
		expect(result.overrides.category).toBe("Leisure");
	});

	it("host rule overrides app rule (precedence)", () => {
		const rules: AutomationRules = {
			apps: {
				"com.google.Chrome": { llm: "allow", category: "Work" },
			},
			hosts: {
				"youtube.com": { llm: "skip", category: "Leisure" },
			},
		};
		const result = evaluateAutomationPolicy(
			{ appBundleId: "com.google.Chrome", urlHost: "youtube.com" },
			rules,
		);
		expect(result.llm).toBe("skip");
		expect(result.overrides.category).toBe("Leisure");
	});

	it("app rule values preserved when host rule does not override them", () => {
		const rules: AutomationRules = {
			apps: {
				"com.google.Chrome": { capture: "skip", projectMode: "skip" },
			},
			hosts: {
				"github.com": { category: "Work" },
			},
		};
		const result = evaluateAutomationPolicy(
			{ appBundleId: "com.google.Chrome", urlHost: "github.com" },
			rules,
		);
		expect(result.capture).toBe("skip");
		expect(result.overrides.projectMode).toBe("skip");
		expect(result.overrides.category).toBe("Work");
	});

	it("applies all override fields correctly", () => {
		const rules: AutomationRules = {
			apps: {},
			hosts: {
				"slack.com": {
					llm: "skip",
					category: "Social",
					tags: ["chat", "messaging"],
					projectMode: "force",
					project: "Team Communication",
				},
			},
		};
		const result = evaluateAutomationPolicy({ urlHost: "slack.com" }, rules);
		expect(result.llm).toBe("skip");
		expect(result.overrides).toEqual({
			category: "Social",
			tags: ["chat", "messaging"],
			projectMode: "force",
			project: "Team Communication",
		});
	});

	it("handles input with no appBundleId or urlHost", () => {
		const rules: AutomationRules = {
			apps: { "com.test.app": { llm: "skip" } },
			hosts: { "test.com": { capture: "skip" } },
		};
		const result = evaluateAutomationPolicy({}, rules);
		expect(result).toEqual({
			capture: "allow",
			llm: "allow",
			overrides: {},
		});
	});

	it("handles null values in input", () => {
		const rules: AutomationRules = {
			apps: { "com.test.app": { llm: "skip" } },
			hosts: { "test.com": { capture: "skip" } },
		};
		const result = evaluateAutomationPolicy(
			{ appBundleId: null, urlHost: null },
			rules,
		);
		expect(result).toEqual({
			capture: "allow",
			llm: "allow",
			overrides: {},
		});
	});
});
