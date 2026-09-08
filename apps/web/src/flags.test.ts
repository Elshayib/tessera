import { expect, test } from "vitest";
import { defaultFlags, parseFlags } from "./flags.js";

test("flags default off", () => {
  const flags = defaultFlags();
  expect(flags.polyhaven).toBe(false);
  expect(flags.agentVerifyLoop).toBe(false);
  expect(parseFlags("?flag=polyhaven&flag=agentVerifyLoop", false).polyhaven).toBe(false);
  expect(parseFlags("?flag=polyhaven", true).polyhaven).toBe(true);
  expect(parseFlags("?flag=unknown", true).polyhaven).toBe(false);
});
