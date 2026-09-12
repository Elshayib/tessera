import { expect, test } from "vitest";
import { bootstrapVerifyMode, defaultFlags, parseFlags } from "./flags.js";

test("flags default off", () => {
  const flags = defaultFlags();
  expect(flags.polyhaven).toBe(true);
  expect(flags.agentVerifyLoop).toBe(false);
  expect(bootstrapVerifyMode(defaultFlags())).toBe("none");
  expect(bootstrapVerifyMode({ ...defaultFlags(), agentVerifyLoop: true })).toBe("spatial");
  expect(flags.createMenu).toBe(true);
  expect(parseFlags("?flag=createMenu", true).createMenu).toBe(true);
  expect(parseFlags("?flag=polyhaven&flag=agentVerifyLoop", false).polyhaven).toBe(true);
  expect(parseFlags("?flag=polyhaven", true).polyhaven).toBe(true);
  expect(parseFlags("?flag=unknown", true).polyhaven).toBe(true);
});

test("agentDryRun default false", () => {
  expect(defaultFlags().agentDryRun).toBe(false);
  expect(parseFlags("?flag=agentDryRun", true).agentDryRun).toBe(true);
  expect(parseFlags("?flag=agentDryRun", false).agentDryRun).toBe(false);
});
