import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("upload input is present in the asset panel", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "asset-panel.tsx"),
    "utf8",
  );
  expect(source.includes('type="file"')).toBe(true);
  expect(source.includes("importFiles")).toBe(true);
  expect(source.includes("licenseNudge")).toBe(true);
});
