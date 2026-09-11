import { expect, test } from "vitest";

test("web production sources import agent observability, not the runtime barrel", () => {
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
    expect(source.includes('from "@tessera/agent"'), path).toBe(false);
    expect(source.includes("from '@tessera/agent'"), path).toBe(false);
    expect(source.includes('from "@tessera/providers-llm"'), path).toBe(false);
    expect(source.includes("from '@tessera/providers-llm'"), path).toBe(false);
    if (path.endsWith("/app.tsx") || path.endsWith("\\app.tsx")) {
      expect(source.includes('from "./create-agent-runtime.js"'), path).toBe(false);
    }
  }
});
