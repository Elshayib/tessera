import { expect, test } from "vitest";

test("INV-AST-02 worker does not import CommandBus", () => {
  const sources = import.meta.glob("./import-*.ts", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  const production = Object.entries(sources).filter(([path]) => !path.includes(".test."));
  expect(production.some(([path]) => path.endsWith("/import-worker.ts"))).toBe(true);
  expect(production.some(([path]) => path.endsWith("/import-plan.ts"))).toBe(true);
  for (const [path, source] of production) {
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes("CommandBus"), path).toBe(false);
    expect(source.includes("createCommandBus"), path).toBe(false);
    expect(source.includes("Y.Map"), path).toBe(false);
    expect(source.includes('from "yjs"'), path).toBe(false);
    expect(source.includes('from "@tessera/core"'), path).toBe(false);
  }
});
