import { expect, test } from "vitest";
import { isScoredPhase2 } from "../../src/runner.js";
import { CORE_20_CASE_IDS, CORE_EVAL_CASES } from "./core-20.eval.js";

test("core-20 suite lists exactly the 20 ids from 13 §5.4", () => {
  expect(CORE_20_CASE_IDS).toHaveLength(20);
  expect(CORE_EVAL_CASES.map((item) => item.id)).toEqual([...CORE_20_CASE_IDS]);
});

test("needs-generation tagged on core.generate-barrel and skipped in phase-2 replay scoring", () => {
  const barrel = CORE_EVAL_CASES.find((item) => item.id === "core.generate-barrel");
  expect(barrel?.tags).toContain("needs-generation");
  expect(barrel?.tags).toContain("core-20");
  expect(barrel !== undefined && isScoredPhase2(barrel)).toBe(false);
  const cube = CORE_EVAL_CASES.find((item) => item.id === "core.red-cube");
  expect(cube !== undefined && isScoredPhase2(cube)).toBe(true);
});
