import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("ADRs 0001–0016 are Accepted", () => {
  const adrDir = join(dirname(fileURLToPath(import.meta.url)), "../docs/adr");
  const names = readdirSync(adrDir);
  for (let number = 1; number <= 16; number += 1) {
    const prefix = `ADR-${String(number).padStart(4, "0")}`;
    const match = names.find((name) => name.startsWith(prefix) && name.endsWith(".md"));
    expect(match !== undefined, `missing ${prefix}`).toBe(true);
    if (match === undefined) {
      return;
    }
    const text = readFileSync(join(adrDir, match), "utf8");
    expect(text.includes("Status: Accepted"), `${match} is not Accepted`).toBe(true);
  }
});
