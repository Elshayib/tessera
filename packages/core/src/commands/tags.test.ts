import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("tags.add / tags.remove reject / success / change set", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const created = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = created.value.output.id;
  expect(
    isErr(bus.execute("tags.add", { target: "e_zzzzzzzzzz", tags: ["wood"] }, { author })),
  ).toBe(true);
  const added = bus.execute("tags.add", { target: id, tags: ["wood", "static"] }, { author });
  expect(isOk(added)).toBe(true);
  if (!added.ok) {
    return;
  }
  expect(added.value.output.tags).toEqual(["wood", "static"]);
  expect(added.value.transaction.changeSet.entities.updated.length).toBeGreaterThan(0);
  const removed = bus.execute("tags.remove", { target: id, tags: ["wood"] }, { author });
  expect(isOk(removed)).toBe(true);
  expect(reader.getEntity(id)?.components.tags).toEqual(["static"]);
});
