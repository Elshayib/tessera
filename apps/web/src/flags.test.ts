import { expect, test } from "vitest";
import { defaultFlags, parseFlags } from "./flags.js";

test("flags default off", () => {
  const flags = defaultFlags();
  expect(flags.polyhaven).toBe(true);
  expect(flags.agentVerifyLoop).toBe(false);
  expect(flags.createMenu).toBe(false);
  expect(parseFlags("?flag=createMenu", true).createMenu).toBe(true);
  expect(parseFlags("?flag=polyhaven&flag=agentVerifyLoop", false).polyhaven).toBe(true);
  expect(parseFlags("?flag=polyhaven", true).polyhaven).toBe(true);
  expect(parseFlags("?flag=unknown", true).polyhaven).toBe(true);
});
