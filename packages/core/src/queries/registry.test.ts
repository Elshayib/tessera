import { ENGINE_QUERY_NAMES, QUERY_CATALOG } from "@tessera/schema";
import { isErr } from "@tessera/std";
import { expect, test } from "vitest";
import { createDocument } from "../create-document.js";
import { createQueryHost } from "./host.js";

test("INV-CMD-10 headless queries are registered and engine names are not", () => {
  const { doc } = createDocument();
  const host = createQueryHost(doc, { history: () => [] });
  for (const schema of QUERY_CATALOG) {
    const definition = host.registry.get(schema.name);
    expect(definition !== undefined).toBe(true);
    if (definition === undefined) {
      continue;
    }
    expect(definition.description.length).toBeGreaterThan(0);
    expect(typeof definition.handle).toBe("function");
  }
  expect(host.registry.list()).toHaveLength(QUERY_CATALOG.length);
  for (const name of ENGINE_QUERY_NAMES) {
    expect(host.registry.has(name)).toBe(false);
    const result = host.query(name, {});
    expect(isErr(result) && result.error.code === "UNSUPPORTED").toBe(true);
  }
});
