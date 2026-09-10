import type { Document, Entity } from "@tessera/schema";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { sortByHierarchy } from "./sort-by-hierarchy.js";
import type { SpatialReader } from "./types.js";

function snapshotReader(snapshot: Document): SpatialReader {
  return {
    getEntity: (id) => snapshot.entities[id],
    getAsset: (id) => snapshot.assets[id],
    parentChain(id) {
      const chain: Entity[] = [];
      const visiting = new Set<string>();
      let current: string | null = id;
      while (current !== null) {
        if (visiting.has(current)) {
          break;
        }
        visiting.add(current);
        const entity = snapshot.entities[current];
        if (entity === undefined) {
          break;
        }
        chain.push(entity);
        current = entity.parent;
      }
      return chain;
    },
  };
}

test("sortByHierarchy parents before children", () => {
  const snapshot = docBuilder()
    .entity("root")
    .entity("child", { parent: "root" })
    .entity("leaf", { parent: "child" })
    .entity("other")
    .build();
  const reader = snapshotReader(snapshot);
  const byName = new Map(
    Object.values(snapshot.entities).map((entity) => [entity.name, entity.id]),
  );
  const root = byName.get("root");
  const child = byName.get("child");
  const leaf = byName.get("leaf");
  const other = byName.get("other");
  expect(
    root !== undefined && child !== undefined && leaf !== undefined && other !== undefined,
  ).toBe(true);
  if (root === undefined || child === undefined || leaf === undefined || other === undefined) {
    return;
  }
  const sorted = sortByHierarchy([leaf, other, child, root], reader);
  expect(sorted.indexOf(root)).toBeLessThan(sorted.indexOf(child));
  expect(sorted.indexOf(child)).toBeLessThan(sorted.indexOf(leaf));
  expect(sorted).toHaveLength(4);
  const unknown = sortByHierarchy(["e_zzzzzzzzzz", root], reader);
  expect(unknown[0]).toBe("e_zzzzzzzzzz");
  expect(unknown[1]).toBe(root);
});
