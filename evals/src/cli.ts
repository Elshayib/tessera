import { parseEvalArgs, runEvals, scoreResults } from "./runner.js";

async function main(): Promise<void> {
  const cli = parseEvalArgs(process.argv.slice(2));
  const ci = process.env["CI"] === "true" || process.env["CI"] === "1";
  const { results, leaderboardWritten } = await runEvals({
    cli: { ...cli, ...(ci ? { ci: true } : {}) },
  });
  const scored = results.filter((row) => row.scored);
  const mean = scoreResults(results);
  const payload = `${JSON.stringify({ mean, scored: scored.length, leaderboardWritten, results }, null, 2)}\n`;
  process.stdout.write(payload);
  const failed = scored.some((row) => row.error !== undefined || row.hardScore < 1);
  if (failed) {
    process.exitCode = 1;
  }
}

void main();
