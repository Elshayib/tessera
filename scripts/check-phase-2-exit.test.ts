import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("runbook exists and names two providers and 90%", () => {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../docs/runbooks/phase-2-agent-check.md",
  );
  expect(existsSync(path)).toBe(true);
  const text = readFileSync(path, "utf8");
  expect(text.includes("pnpm eval:replay")).toBe(true);
  expect(text.includes("90%")).toBe(true);
  expect(text.includes("openai")).toBe(true);
  expect(text.includes("anthropic")).toBe(true);
  expect(text.includes("Add a red cube 1 m on each side at the origin.")).toBe(true);
  expect(text.includes("Create a table with four chairs around it.")).toBe(true);
  expect(text.includes("Describe the scene.")).toBe(true);
  expect(text.includes("m2-agent-v1")).toBe(true);
  expect(text.includes("evals/fixtures/recordings")).toBe(true);
});
