import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { findForbiddenYjsUsages } from "./check-no-direct-yjs.js";

test("check-no-direct-yjs script flags a fixture string", () => {
  const hits = findForbiddenYjsUsages([
    {
      path: "packages/schema/src/evil.ts",
      text: 'import * as Y from "yjs";\nydoc.transact(() => {});\n',
    },
    {
      path: "packages/core/src/yjs-mapping.ts",
      text: 'import * as Y from "yjs";\nydoc.transact(() => {});\n',
    },
    {
      path: "packages/storage/src/memory-project-store.ts",
      text: 'import * as Y from "yjs";\nconst ydoc = new Y.Doc();\n',
    },
    {
      path: "packages/storage/src/evil.ts",
      text: 'import * as Y from "yjs";\nydoc.transact(() => {});\n',
    },
  ]);
  expect(hits.some((hit) => hit.includes("packages/schema/src/evil.ts"))).toBe(true);
  expect(hits.some((hit) => hit.includes("packages/core"))).toBe(false);
  expect(hits.some((hit) => hit.includes("packages/storage/src/memory-project-store.ts"))).toBe(
    false,
  );
  expect(hits.some((hit) => hit.includes("packages/storage/src/evil.ts"))).toBe(true);

  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "check-no-direct-yjs.ts"), "utf8");
  expect(source.includes("findForbiddenYjsUsages")).toBe(true);
});
