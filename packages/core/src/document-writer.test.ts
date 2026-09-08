import type { Entity } from "@tessera/schema";
import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createDocument } from "./index.js";
import { createTestWriter } from "./internal/document-writer.js";

const transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

function entity(partial: Pick<Entity, "id" | "name" | "parent" | "order">): Entity {
  return {
    ...partial,
    enabled: true,
    components: { transform: { ...transform, scale: [1, 1, 1] } },
  };
}

test("INV-DOC-02/03 writer rejects missing parent and cycles", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const writer = createTestWriter(doc);
  const root = entity({ id: "e_0000000000", name: "Root", parent: null, order: "a0" });
  const child: Entity = {
    ...entity({ id: "e_0000000001", name: "Child", parent: "e_0000000000", order: "a0" }),
    components: {
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      tags: ["prop"],
    },
  };
  expect(isOk(writer.createEntity(root))).toBe(true);
  expect(isOk(writer.createEntity(child))).toBe(true);
  expect(reader.getEntity(root.id)?.name).toBe("Root");

  const missing = writer.createEntity(
    entity({ id: "e_0000000002", name: "Orphan", parent: "e_deadbeef00", order: "a0" }),
  );
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);

  const self = writer.updateEntity(
    entity({ id: "e_0000000000", name: "Root", parent: "e_0000000000", order: "a0" }),
  );
  expect(isErr(self) && self.error.code === "CONFLICT").toBe(true);

  const cycle = writer.updateEntity(
    entity({ id: "e_0000000000", name: "Root", parent: "e_0000000001", order: "a0" }),
  );
  expect(isErr(cycle) && cycle.error.code === "CONFLICT").toBe(true);

  const duplicate = writer.createEntity(root);
  expect(isErr(duplicate) && duplicate.error.code === "CONFLICT").toBe(true);
  const blockedDelete = writer.deleteEntity("e_0000000000");
  expect(isErr(blockedDelete) && blockedDelete.error.code === "CONFLICT").toBe(true);
  expect(isOk(writer.deleteEntity(child.id))).toBe(true);
  expect(isOk(writer.deleteEntity(root.id))).toBe(true);
  expect(isErr(writer.deleteEntity(root.id))).toBe(true);
  expect(isErr(writer.updateEntity(root))).toBe(true);

  const built = docBuilder().entity("box_01", { mesh: "box" }).build();
  const asset = Object.values(built.assets)[0];
  expect(asset !== undefined).toBe(true);
  if (asset === undefined) {
    return;
  }
  expect(isOk(writer.createAsset(asset))).toBe(true);
  expect(isOk(writer.updateAsset(asset))).toBe(true);
  expect(isErr(writer.createAsset(asset))).toBe(true);
  expect(reader.getAsset(asset.id)?.kind).toBe("geometry");
  expect([...reader.assets("geometry")].length).toBe(1);
  expect(isOk(writer.deleteAsset(asset.id))).toBe(true);
  expect(isErr(writer.deleteAsset(asset.id))).toBe(true);
  expect(isErr(writer.updateAsset(asset))).toBe(true);

  const script = {
    id: "a_script0000",
    kind: "script" as const,
    name: "spin",
    license: "unknown",
    provenance: { source: "derived", importedAt: emptyDocument().meta.createdAt },
    createdAt: emptyDocument().meta.createdAt,
    language: "ts" as const,
    apiVersion: "1",
  };
  expect(isOk(writer.createAsset(script))).toBe(true);
  const behavior = {
    id: "b_0000000000",
    name: "spin",
    target: "e_0000000000",
    script: script.id,
    params: {},
    enabled: true,
  };
  expect(isOk(writer.upsertBehavior(behavior))).toBe(true);
  expect(isOk(writer.upsertBehavior({ ...behavior, enabled: false }))).toBe(true);
  expect(reader.getBehavior(behavior.id)?.enabled).toBe(false);
  expect(isOk(writer.deleteBehavior(behavior.id))).toBe(true);
  expect(isErr(writer.deleteBehavior(behavior.id))).toBe(true);
  expect(isOk(writer.setEnvironment({ ...reader.snapshot().environment, exposure: 2 }))).toBe(true);
  expect(
    isOk(writer.setSettings({ ...reader.snapshot().settings, physics: { gravity: [0, 0, 0] } })),
  ).toBe(true);
  expect(isOk(writer.setMeta({ ...reader.snapshot().meta, name: "Renamed" }))).toBe(true);
  expect(isErr(writer.removeEntityUnchecked("e_missing000"))).toBe(true);
});
