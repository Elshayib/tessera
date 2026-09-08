import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const FORBIDDEN = ['from "ai"', 'from "@ai-sdk', 'from "@openrouter/'];

test("INV-PRV-01 only ai-sdk-bridge imports ai / @ai-sdk / @openrouter", () => {
  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) {
        walk(path);
        continue;
      }
      if (!name.name.endsWith(".ts") || name.name.endsWith(".test.ts")) {
        continue;
      }
      files.push(path);
    }
  };
  walk(srcRoot);
  for (const file of files) {
    if (file.endsWith(`${join("internal", "ai-sdk-bridge.ts")}`)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    for (const needle of FORBIDDEN) {
      expect(source.includes(needle), file).toBe(false);
    }
  }
});
