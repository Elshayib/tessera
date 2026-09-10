import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installFetchGuard, ReplayLlmClient } from "@tessera/testing";
import { loadRecordingsForModel } from "./load-recordings.js";
import { parseEvalArgs, runEvals, scoreResults } from "./runner.js";

async function main(): Promise<void> {
  const cli = parseEvalArgs(process.argv.slice(2));
  const ci = process.env["CI"] === "true" || process.env["CI"] === "1";
  const restore = installFetchGuard();
  try {
    const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/recordings");
    const slash = cli.model.indexOf("/");
    const providerId = slash <= 0 ? "fake" : cli.model.slice(0, slash);
    const modelId = slash <= 0 ? cli.model : cli.model.slice(slash + 1);
    const recordings = await loadRecordingsForModel(fixtures, { providerId, modelId });
    const { results, leaderboardWritten } = await runEvals({
      cli: { ...cli, ...(ci ? { ci: true } : {}) },
      recordings,
      llm: new ReplayLlmClient({ recordings }),
    });
    const scored = results.filter((row) => row.scored);
    const mean = scoreResults(results);
    const payload = `${JSON.stringify({ mean, scored: scored.length, leaderboardWritten, results }, null, 2)}\n`;
    process.stdout.write(payload);
    const failedMean = cli.mode === "replay" && mean < 0.9;
    if (failedMean) {
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}

void main();
