import { expect, test } from "vitest";

test("INV-EXP-01 exporters do not import engine", () => {
  const sources = import.meta.glob("./**/*.ts", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  const production = Object.entries(sources).filter(
    ([path]) => !path.includes(".test.") && !path.includes(".int."),
  );
  expect(production.length).toBeGreaterThan(0);
  for (const [path, source] of production) {
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes('from "@tessera/engine"'), path).toBe(false);
    expect(source.includes('from "three"'), path).toBe(false);
  }
});
