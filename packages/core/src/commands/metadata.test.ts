import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("metadata.set reject / success / change set", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  expect(
    isErr(bus.execute("metadata.set", { target: "e_zzzzzzzzzz", patch: { a: 1 } }, { author })),
  ).toBe(true);
  const created = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = created.value.output.id;
  const set = bus.execute("metadata.set", { target: id, patch: { note: "hi" } }, { author });
  expect(isOk(set)).toBe(true);
  if (!set.ok) {
    return;
  }
  expect(reader.getEntity(id)?.components.metadata).toEqual({ note: "hi" });
  expect(set.value.transaction.changeSet.entities.updated.length).toBeGreaterThan(0);
  bus.execute("metadata.set", { target: id, patch: { note: null } }, { author });
  expect(reader.getEntity(id)?.components.metadata).toBeUndefined();
});
