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

test("T-0101–T-0122 have Goal, Context, Touches, AC, Tests, Non-goals", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../docs/tasks/phase-1.md");
  const text = readFileSync(path, "utf8");
  for (let number = 101; number <= 122; number += 1) {
    const id = `T-0${String(number)}`;
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
