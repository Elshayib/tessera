import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

function setup() {
  const created = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(created.doc);
  const entity = bus.execute("entity.create", { name: "prop" }, { author });
  return { ...created, bus, entity };
}

test("component.add reject / success / change set", () => {
  const { bus, entity } = setup();
  expect(isOk(entity)).toBe(true);
  if (!entity.ok) {
    return;
  }
  const id = entity.value.output.id;
  const duplicate = bus.execute("component.add", { target: id, type: "transform" }, { author });
  expect(isErr(duplicate) && duplicate.error.code === "CONFLICT").toBe(true);
  const rigid = bus.execute("component.add", { target: id, type: "rigidBody" }, { author });
  expect(isErr(rigid) && rigid.error.code === "CONFLICT").toBe(true);
  const added = bus.execute("component.add", { target: id, type: "camera" }, { author });
  expect(isOk(added)).toBe(true);
  if (!added.ok) {
    return;
  }
  expect(added.value.transaction.changeSet.entities.updated.length).toBeGreaterThan(0);
});

test("component.remove and component.set", () => {
  const { bus, entity, reader } = setup();
  expect(isOk(entity)).toBe(true);
  if (!entity.ok) {
    return;
  }
  const id = entity.value.output.id;
  expect(
    isErr(bus.execute("component.remove", { target: id, type: "transform" }, { author })),
  ).toBe(true);
  bus.execute("component.add", { target: id, type: "collider" }, { author });
  bus.execute("component.add", { target: id, type: "rigidBody" }, { author });
  const removed = bus.execute("component.remove", { target: id, type: "collider" }, { author });
  expect(isOk(removed)).toBe(true);
  expect(reader.getEntity(id)?.components.rigidBody).toBeUndefined();
  bus.execute("component.add", { target: id, type: "camera" }, { author });
  const patched = bus.execute(
    "component.set",
    { target: id, type: "camera", patch: { fov: 40 } },
    { author },
  );
  expect(isOk(patched)).toBe(true);
  expect(reader.getEntity(id)?.components.camera?.fov).toBe(40);
  expect(
    isErr(bus.execute("component.set", { target: id, type: "light", patch: {} }, { author })),
  ).toBe(true);
});
