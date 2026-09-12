import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

function busOf() {
  const created = createDocument({ snapshot: emptyDocument() });
  return { ...created, bus: createCommandBus(created.doc), author };
}

test("entity.create reject / success / change set", () => {
  const { bus, reader } = busOf();
  const missingParent = bus.execute(
    "entity.create",
    { name: "oak", parent: "e_zzzzzzzzzz" },
    { author },
  );
  expect(isErr(missingParent) && missingParent.error.code === "NOT_FOUND").toBe(true);

  const created = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  expect(created.value.transaction.changeSet.entities.created).toContain(created.value.output.id);
  expect(reader.getEntity(created.value.output.id)?.name).toBe("oak");

  const collision = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(collision)).toBe(true);
  if (!collision.ok) {
    return;
  }
  expect(reader.getEntity(collision.value.output.id)?.name).toBe("oak_01");

  const strict = bus.execute("entity.create", { name: "oak", strictName: true }, { author });
  expect(isErr(strict) && strict.error.code === "CONFLICT").toBe(true);
});

test("entity.create appends after a docBuilder sibling", () => {
  const snapshot = docBuilder().entity("wall", { mesh: "box" }).build();
  const createdDoc = createDocument({ snapshot });
  const bus = createCommandBus(createdDoc.doc);
  const created = bus.execute("entity.create", { name: "barrel" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  expect(createdDoc.reader.getEntity(created.value.output.id)?.name).toBe("barrel");
});

test("entity.delete reject / success / subtree", () => {
  const { bus, reader } = busOf();
  const missing = bus.execute("entity.delete", { target: "e_zzzzzzzzzz" }, { author });
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);

  const parent = bus.execute("entity.create", { name: "grove" }, { author });
  expect(isOk(parent)).toBe(true);
  if (!parent.ok) {
    return;
  }
  const child = bus.execute(
    "entity.create",
    { name: "oak", parent: parent.value.output.id },
    { author },
  );
  expect(isOk(child)).toBe(true);
  if (!child.ok) {
    return;
  }
  const deleted = bus.execute("entity.delete", { target: parent.value.output.id }, { author });
  expect(isOk(deleted)).toBe(true);
  if (!deleted.ok) {
    return;
  }
  expect(deleted.value.output.deleted).toContain(parent.value.output.id);
  expect(deleted.value.output.deleted).toContain(child.value.output.id);
  expect(reader.getEntity(parent.value.output.id)).toBeUndefined();
});

test("entity.duplicate reject / success", () => {
  const { bus, reader } = busOf();
  const missing = bus.execute("entity.duplicate", { target: "e_zzzzzzzzzz" }, { author });
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
  const created = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const duplicated = bus.execute(
    "entity.duplicate",
    { target: created.value.output.id, count: 2, offset: [1, 0, 0] },
    { author },
  );
  expect(isOk(duplicated)).toBe(true);
  if (!duplicated.ok) {
    return;
  }
  expect(duplicated.value.output.ids).toHaveLength(2);
  expect([...reader.entities()]).toHaveLength(3);
});

test("entity.rename / reorder / setEnabled", () => {
  const { bus, reader } = busOf();
  const first = bus.execute("entity.create", { name: "oak" }, { author });
  const second = bus.execute("entity.create", { name: "pine" }, { author });
  expect(isOk(first) && isOk(second)).toBe(true);
  if (!first.ok || !second.ok) {
    return;
  }
  const renamed = bus.execute(
    "entity.rename",
    { target: first.value.output.id, name: "cedar" },
    { author },
  );
  expect(isOk(renamed) && renamed.value.output.name === "cedar").toBe(true);
  const reordered = bus.execute(
    "entity.reorder",
    { target: first.value.output.id, after: null },
    { author },
  );
  expect(isOk(reordered)).toBe(true);
  const disabled = bus.execute(
    "entity.setEnabled",
    { target: first.value.output.id, enabled: false },
    { author },
  );
  expect(isOk(disabled)).toBe(true);
  expect(reader.getEntity(first.value.output.id)?.enabled).toBe(false);
});

test("entity.setParent cycle; keepWorldTransform", () => {
  const { bus, reader } = busOf();
  const root = bus.execute("entity.create", { name: "root" }, { author });
  expect(isOk(root)).toBe(true);
  if (!root.ok) {
    return;
  }
  const child = bus.execute(
    "entity.create",
    {
      name: "child",
      parent: root.value.output.id,
      components: { transform: { position: [1, 0, 0] } },
    },
    { author },
  );
  expect(isOk(child)).toBe(true);
  if (!child.ok) {
    return;
  }
  const cycle = bus.execute(
    "entity.setParent",
    { target: root.value.output.id, parent: child.value.output.id },
    { author },
  );
  expect(isErr(cycle) && cycle.error.code === "CONFLICT").toBe(true);

  const other = bus.execute(
    "entity.create",
    { name: "anchor", components: { transform: { position: [1, 0, 0] } } },
    { author },
  );
  expect(isOk(other)).toBe(true);
  if (!other.ok) {
    return;
  }
  const reparented = bus.execute(
    "entity.setParent",
    {
      target: child.value.output.id,
      parent: other.value.output.id,
      keepWorldTransform: true,
    },
    { author },
  );
  expect(isOk(reparented)).toBe(true);
  const local = reader.getEntity(child.value.output.id)?.components.transform.position;
  expect(local !== undefined).toBe(true);
  if (local === undefined) {
    return;
  }
  expect(Math.abs(local[0])).toBeLessThan(1e-6);
  expect(Math.abs(local[1])).toBeLessThan(1e-6);
  expect(Math.abs(local[2])).toBeLessThan(1e-6);
});
