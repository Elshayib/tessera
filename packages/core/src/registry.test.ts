import { COMMAND_CATALOG } from "@tessera/schema";
import { expect, test } from "vitest";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";

test("INV-CMD-10 every catalog command is registered", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const expected = COMMAND_CATALOG.filter((command) => command.name !== "asset.import");
  expect(bus.registry.has("asset.import")).toBe(false);
  for (const schema of expected) {
    const definition = bus.registry.get(schema.name);
    expect(definition !== undefined).toBe(true);
    if (definition === undefined) {
      continue;
    }
    expect(definition.input).toBeDefined();
    expect(definition.output).toBeDefined();
    expect(definition.description.length).toBeGreaterThan(0);
    expect(definition.tier).toBe(schema.tier);
    expect(typeof definition.handle).toBe("function");
  }
  expect(bus.registry.list()).toHaveLength(expected.length);
});
