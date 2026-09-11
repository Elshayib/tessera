import { expect, test } from "vitest";
import { parseJsonModeTools } from "./json-mode.js";

test("json-mode parse then two failures end run", () => {
  const parsed = parseJsonModeTools('```tool\n{"name":"plan.set","input":{"items":[]}}\n```');
  expect(parsed.ok).toBe(true);
  expect(parseJsonModeTools("not json").ok).toBe(false);
  expect(parseJsonModeTools("```tool\n{\n```").ok).toBe(false);
});
