import { createDocument } from "@tessera/core";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { sortByHierarchy } from "./sort-by-hierarchy.js";

test("sortByHierarchy parents before children", () => {
  const snapshot = docBuilder()
    .entity("root")
    .entity("child", { parent: "root" })
    .entity("leaf", { parent: "child" })
    .entity("other")
    .build();
  const { reader } = createDocument({ snapshot });
  const byName = new Map([...reader.entities()].map((entity) => [entity.name, entity.id]));
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
