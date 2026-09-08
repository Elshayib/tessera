import { expect, test } from "vitest";

test("INV-ARCH-02 engine does not import CommandBus", () => {
  const sources = import.meta.glob("./**/*.ts", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  const production = Object.entries(sources).filter(([path]) => !path.includes(".test."));
  expect(production.some(([path]) => path.endsWith("/host.ts"))).toBe(true);
  for (const [path, source] of production) {
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes("CommandBus"), path).toBe(false);
  }
});
