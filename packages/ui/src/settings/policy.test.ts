import { expect, test } from "vitest";
import { SETTINGS_RUN_POLICY_DEFAULTS } from "./policy.js";

test("RunPolicy defaults match 06 §3", () => {
  expect(SETTINGS_RUN_POLICY_DEFAULTS.maxSteps).toBe(24);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.maxToolCallsPerStep).toBe(16);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.maxInputTokens).toBe(400_000);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.timeoutMs).toBe(600_000);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.maxRepairRounds).toBe(2);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.confirmDestructive).toBe(false);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.temperature).toBe(0.2);
  expect(SETTINGS_RUN_POLICY_DEFAULTS.enabledTiers).toEqual([0, 1, 2]);
});
