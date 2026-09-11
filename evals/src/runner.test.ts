import { installFetchGuard } from "@tessera/testing";
import { afterEach, expect, test } from "vitest";
import { CORE_EVAL_CASES } from "../suites/core/core-20.eval.js";
import { parseEvalArgs, runEvals } from "./runner.js";

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

test("INV-TST-01 replay runner does not fetch non-loopback", async () => {
  restore = installFetchGuard();
  const cube = CORE_EVAL_CASES.find((item) => item.id === "core.describe");
  expect(cube).toBeDefined();
  if (cube === undefined) {
    return;
  }
  await runEvals({
    cli: parseEvalArgs(["--mode", "replay"]),
    cases: [cube],
    recordings: [],
  });
  await expect(globalThis.fetch("https://api.openai.com/v1/models")).rejects.toThrow(
    "INV-TST-01 fetch guard rejected non-loopback host",
  );
});

test("parseEvalArgs defaults to replay", () => {
  expect(parseEvalArgs(["--mode", "replay", "--suite", "core"])).toMatchObject({
    mode: "replay",
    suite: "core",
    model: "fake/fake",
  });
});

test("live mode is rejected when ci is set", async () => {
  await expect(
    runEvals({
      cli: { suite: "core", model: "fake/fake", mode: "live", ci: true },
      cases: [],
      recordings: [],
    }),
  ).rejects.toThrow("live mode is not invoked by CI");
});

test("replay miss fails with TESSERA_RECORD hint", async () => {
  const cube = CORE_EVAL_CASES.find((item) => item.id === "core.red-cube");
  expect(cube).toBeDefined();
  if (cube === undefined) {
    return;
  }
  const { results } = await runEvals({
    cli: parseEvalArgs(["--mode", "replay", "--model", "fake/fake"]),
    cases: [cube],
    recordings: [],
  });
  const first = results[0];
  expect(first?.error).toContain("TESSERA_RECORD=1");
  expect(first?.error).toContain("no recording for request hash");
  expect(first?.scored).toBe(true);
});
