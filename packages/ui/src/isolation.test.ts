import { expect, test } from "vitest";

test("ui production sources do not import three or yjs", () => {
  const sources = import.meta.glob("./**/*.{ts,tsx}", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  const production = Object.entries(sources).filter(
    ([path]) => !path.includes(".test.") && !path.includes(".browser.test."),
  );
  expect(production.length).toBeGreaterThan(0);
  for (const [path, source] of production) {
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes('from "three"'), path).toBe(false);
    expect(source.includes('from "yjs"'), path).toBe(false);
    expect(source.includes("@tessera/providers-llm"), path).toBe(false);
  }
});
