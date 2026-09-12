import { expect, test } from "vitest";
import { isScoredPhase2 } from "../../src/runner.js";
import { CORE_20_CASE_IDS, CORE_EVAL_CASES } from "./core-20.eval.js";

test("core-20 suite lists exactly the 20 ids from 13 §5.4", () => {
  expect(CORE_20_CASE_IDS).toHaveLength(20);
  expect(CORE_EVAL_CASES.map((item) => item.id)).toEqual([...CORE_20_CASE_IDS]);
});

test("core.generate-barrel is scored and assertions match 13 §5.4", () => {
  const barrel = CORE_EVAL_CASES.find((item) => item.id === "core.generate-barrel");
  expect(barrel?.tags).toContain("core-20");
  expect(barrel?.tags?.includes("needs-generation") ?? false).toBe(false);
  expect(barrel !== undefined && isScoredPhase2(barrel)).toBe(true);
  expect(barrel?.prompt).toBe("Generate a low-poly barrel and place it by the wall.");
});
