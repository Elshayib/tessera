import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installFetchGuard, loadRecordingTexts, scanRecordingsForSecrets } from "@tessera/testing";
import { afterEach, expect, test } from "vitest";
import { loadRecordingsForModel, parseRecordingFile } from "../../src/load-recordings.js";
import { PHASE2_REPLAY_MODELS } from "../../src/phase-2-providers.js";
import { isScoredPhase2, parseEvalArgs, runEvals, scoreResults } from "../../src/runner.js";
import { CORE_EVAL_CASES } from "./core-20.eval.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/recordings");

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

test("INV-TST-02 scored core-20 cases have two provider recording paths", () => {
  expect(PHASE2_REPLAY_MODELS).toHaveLength(2);
  expect(PHASE2_REPLAY_MODELS[0]?.providerId).not.toBe(PHASE2_REPLAY_MODELS[1]?.providerId);
  const scored = CORE_EVAL_CASES.filter(isScoredPhase2);
  expect(scored.length).toBeGreaterThan(0);
  for (const evalCase of scored) {
    for (const model of PHASE2_REPLAY_MODELS) {
      const file = join(FIXTURES, model.providerId, "core", `${evalCase.id}.${model.modelId}.json`);
      expect(existsSync(file), file).toBe(true);
      const recordings = parseRecordingFile(file);
      expect(recordings.length).toBeGreaterThan(0);
    }
  }
});

test("INV-TST-04 recordings contain no secrets", async () => {
  const files = await loadRecordingTexts(FIXTURES);
  expect(files.length).toBeGreaterThan(0);
  expect(scanRecordingsForSecrets(files)).toEqual([]);
});

test("INV-TST-01 CI replay uses fixtures only and scores at least 90%", async () => {
  restore = installFetchGuard();
  for (const model of PHASE2_REPLAY_MODELS) {
    const recordings = await loadRecordingsForModel(FIXTURES, model);
    const { results } = await runEvals({
      cli: parseEvalArgs(["--mode", "replay", "--model", `${model.providerId}/${model.modelId}`]),
      recordings,
    });
    const mean = scoreResults(results);
    expect(mean).toBeGreaterThanOrEqual(0.9);
    await expect(globalThis.fetch("https://api.anthropic.com/v1/messages")).rejects.toThrow(
      "INV-TST-01 fetch guard rejected non-loopback host",
    );
  }
});
