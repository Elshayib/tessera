import { expect, test } from "vitest";
import committed from "./generated/catalog.json" with { type: "json" };
import { emitJsonSchema, emitJsonSchemaText } from "./json-schema.js";

test("emit is stable (compare to committed generated/)", () => {
  const first = emitJsonSchema();
  const second = emitJsonSchema();
  expect(first).toEqual(second);
  expect(first).toEqual(committed);
  expect(emitJsonSchemaText()).toBe(`${JSON.stringify(first, null, 2)}\n`);
});
