import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const REQUIRED = [
  "## Goal",
  "## Context",
  "## Touches",
  "## Acceptance criteria",
  "## Tests",
  "## Non-goals",
] as const;

const IMPLEMENTATION_IDS = [
  "T-0301",
  "T-0302",
  "T-0303",
  "T-0304",
  "T-0305",
  "T-0306",
  "T-0307",
  "T-0308",
  "T-0310",
] as const;

test("T-0301–T-0308 and T-0310 have Goal, Context, Touches, AC, Tests, Non-goals", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../docs/tasks/phase-3.md");
  const text = readFileSync(path, "utf8");
  for (const id of IMPLEMENTATION_IDS) {
    const heading = `# ${id} —`;
    const start = text.indexOf(heading);
    expect(start >= 0, `missing heading ${id}`).toBe(true);
    const next = text.indexOf("\n# T-", start + heading.length);
    const body = next === -1 ? text.slice(start) : text.slice(start, next);
    for (const section of REQUIRED) {
      expect(body.includes(section), `${id} missing ${section}`).toBe(true);
    }
    expect(body.includes("Draft — expand"), `${id} still draft`).toBe(false);
    expect(body.includes("| Status |"), `${id} missing Status`).toBe(true);
  }
});

test("T-0309 stays blocked on Q-0003", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../docs/tasks/phase-3.md");
  const text = readFileSync(path, "utf8");
  const start = text.indexOf("# T-0309 —");
  expect(start >= 0).toBe(true);
  const next = text.indexOf("\n# T-", start + "# T-0309 —".length);
  const body = next === -1 ? text.slice(start) : text.slice(start, next);
  expect(body.includes("`blocked`")).toBe(true);
  expect(body.includes("Q-0003")).toBe(true);
});
