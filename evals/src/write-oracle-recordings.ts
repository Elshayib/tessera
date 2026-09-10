import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_EVAL_CASES } from "../suites/core/core-20.eval.js";
import { CaptureLlmClient } from "./capture-llm.js";
import { OracleLlmClient } from "./oracle-llm.js";
import { PHASE2_REPLAY_MODELS } from "./phase-2-providers.js";
import { parseEvalArgs, runEvals } from "./runner.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/recordings");

function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

async function main(): Promise<void> {
  for (const model of PHASE2_REPLAY_MODELS) {
    for (const evalCase of CORE_EVAL_CASES) {
      const capture = new CaptureLlmClient(new OracleLlmClient(evalCase.id));
      await runEvals({
        cli: parseEvalArgs(["--mode", "replay", "--model", `${model.providerId}/${model.modelId}`]),
        cases: [evalCase],
        llm: capture,
      });
      const dir = join(ROOT, sanitizeSegment(model.providerId), "core");
      await mkdir(dir, { recursive: true });
      const path = join(
        dir,
        `${sanitizeSegment(evalCase.id)}.${sanitizeSegment(model.modelId)}.json`,
      );
      const json = `${JSON.stringify(capture.recordings, null, 2)}\n`;
      await writeFile(path, json, "utf8");
    }
  }
}

void main();
