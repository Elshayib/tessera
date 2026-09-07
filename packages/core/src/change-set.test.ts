import { emptyDocument } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { deriveChangeSet, isChangeSetEmpty } from "./change-set.js";
import { createCommandBus } from "./command-bus.js";
import { createDocument } from "./create-document.js";

const author = { kind: "user" as const, id: "tester" };

test("INV-CMD-07 change set before/after match snapshots", () => {
  const { doc, reader } = createDocument();
  const bus = createCommandBus(doc);
  const created = bus.execute("entity.create", { name: "oak" }, { author });
  expect(isOk(created)).toBe(true);
  if (!created.ok) {
    return;
  }
  const id = created.value.output.id;
  const before = reader.getEntity(id);
  expect(before !== undefined).toBe(true);
  if (before === undefined) {
    return;
  }
  const moved = bus.execute("transform.set", { target: id, position: [1, 2, 3] }, { author });
  expect(isOk(moved)).toBe(true);
  if (!moved.ok) {
    return;
  }
  const after = reader.getEntity(id);
  expect(after !== undefined).toBe(true);
  if (after === undefined) {
    return;
  }
  const positionChange = moved.value.transaction.changeSet.entities.updated
    .find((change) => change.id === id)
    ?.fields.find((field) => field.path === "components.transform.position");
  expect(positionChange?.before).toEqual(before.components.transform.position);
  expect(positionChange?.after).toEqual(after.components.transform.position);
  expect(positionChange?.after).toEqual([1, 2, 3]);
});

test("deriveChangeSet covers behaviors, environment, and settings", () => {
  const before = emptyDocument();
  const createdAt = before.meta.createdAt;
  const after = {
    ...before,
    environment: { ...before.environment, exposure: 2 },
    settings: { ...before.settings, physics: { gravity: [0, 0, 0] } },
    behaviors: {
      b_0000000000: {
        id: "b_0000000000",
        name: "spin",
        target: "e_0000000000",
        script: "a_0000000000",
        params: {},
        enabled: true,
      },
    },
    assets: {
      a_0000000000: {
        id: "a_0000000000",
        kind: "script" as const,
        name: "spin",
        license: "unknown",
        provenance: { source: "derived", importedAt: createdAt },
        createdAt,
        language: "ts" as const,
        apiVersion: "1",
      },
    },
  };
  const created = deriveChangeSet(before, after, "");
  expect(created.behaviors.created).toEqual(["b_0000000000"]);
  expect(created.assets.created).toEqual(["a_0000000000"]);
  expect(created.environment?.length).toBeGreaterThan(0);
  expect(created.settings?.length).toBeGreaterThan(0);
  expect(isChangeSetEmpty(created)).toBe(false);

  const previousBehavior = after.behaviors["b_0000000000"];
  expect(previousBehavior !== undefined).toBe(true);
  if (previousBehavior === undefined) {
    return;
  }
  const updated = deriveChangeSet(
    after,
    {
      ...after,
      behaviors: {
        b_0000000000: { ...previousBehavior, enabled: false, params: { n: 1 } },
      },
    },
    "",
  );
  expect(updated.behaviors.updated).toEqual(["b_0000000000"]);

  const deleted = deriveChangeSet(after, before, "");
  expect(deleted.behaviors.deleted).toEqual(["b_0000000000"]);
  expect(deleted.assets.deleted.map((asset) => asset.id)).toEqual(["a_0000000000"]);
});
