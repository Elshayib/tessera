import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("runbook names replay, generate-barrel scored, TESSERA_LIVE=1", () => {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../docs/runbooks/phase-3-assets-check.md",
  );
  expect(existsSync(path)).toBe(true);
  const text = readFileSync(path, "utf8");
  expect(text.includes("pnpm eval:replay")).toBe(true);
  expect(text.includes("core.generate-barrel")).toBe(true);
  expect(text.includes("scored")).toBe(true);
  expect(text.includes("TESSERA_LIVE=1")).toBe(true);
  expect(text.includes("m3-assets")).toBe(true);
});
