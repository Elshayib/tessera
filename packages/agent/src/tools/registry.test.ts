import { createCommandBus, createDocument, createQueryHost } from "@tessera/core";
import { expect, test } from "vitest";
import { createToolRegistry } from "./registry.js";

test("ToolRegistry register list get and filter", () => {
  const { doc } = createDocument();
  const bus = createCommandBus(doc);
  const host = createQueryHost(doc, { history: () => [] });
  const registry = createToolRegistry();
  registry.deriveFromRegistries(bus.registry, host.registry);
  expect(registry.get("entity.create")?.name).toBe("entity.create");
  const reads = registry.list({ tiers: [0] });
  expect(reads.every((tool) => tool.tier === 0)).toBe(true);
  const entities = registry.list({ groups: ["entities"] });
  expect(entities.every((tool) => tool.group === "entities")).toBe(true);
  expect(registry.get("missing.tool")).toBeUndefined();
});
