import type { Entity } from "@tessera/schema";
import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import * as Y from "yjs";
import { createDocument } from "./index.js";
import { createTestWriter } from "./internal/document-writer.js";
import { entitiesMap } from "./yjs-mapping.js";

function entity(partial: Pick<Entity, "id" | "name" | "parent" | "order">): Entity {
  return {
    ...partial,
    enabled: true,
    components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
  };
}

test("path resolve and children order (fractional index)", () => {
  const clock = new FakeClock();
  const { doc, reader } = createDocument({ snapshot: emptyDocument(), clock });
  const writer = createTestWriter(doc);
  expect(
    isOk(
      writer.createEntity(entity({ id: "e_0000000000", name: "Root", parent: null, order: "a1" })),
    ),
  ).toBe(true);
  expect(
    isOk(
      writer.createEntity(
        entity({ id: "e_0000000001", name: "B", parent: "e_0000000000", order: "a1" }),
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      writer.createEntity(
        entity({ id: "e_0000000002", name: "A", parent: "e_0000000000", order: "a0" }),
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      writer.createEntity(
        entity({ id: "e_0000000003", name: "C", parent: "e_0000000000", order: "a0" }),
      ),
    ),
  ).toBe(true);
  expect(reader.children("e_0000000000").map((item) => item.name)).toEqual(["A", "C", "B"]);
  expect(reader.resolvePath("/Root/A")?.id).toBe("e_0000000002");
  expect(reader.pathOf("e_0000000002")).toBe("/Root/A");
  expect(reader.parentChain("e_0000000002").map((item) => item.name)).toEqual(["A", "Root"]);
  expect([...reader.entities()].length).toBe(4);
  expect(reader.children(null)[0]?.name).toBe("Root");
  expect(reader.resolvePath("/Nope")).toBeUndefined();
  expect(reader.pathOf("e_missing000")).toBeUndefined();
  expect(reader.getBehavior("b_missing000")).toBeUndefined();
  expect([...reader.assets()].length).toBe(0);
  let notifications = 0;
  const stop = reader.subscribe(() => {
    notifications += 1;
  });
  expect(
    isOk(
      writer.updateEntity(entity({ id: "e_0000000000", name: "Root2", parent: null, order: "a1" })),
    ),
  ).toBe(true);
  expect(notifications).toBeGreaterThan(0);
  stop();

  const childMap = entitiesMap(doc.ydoc).get("e_0000000001");
  const rootMap = entitiesMap(doc.ydoc).get("e_0000000000");
  expect(childMap instanceof Y.Map && rootMap instanceof Y.Map).toBe(true);
  if (childMap instanceof Y.Map && rootMap instanceof Y.Map) {
    rootMap.set("parent", "e_0000000001");
  }
  expect(reader.parentChain("e_0000000001").length).toBeGreaterThan(0);
});
