import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";
import { createTestWriter } from "../internal/document-writer.js";

const author = { kind: "user" as const, id: "tester" };

test("catalog paths: refs, force-delete, behaviors, and remaining commands", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc, { blobs: { has: () => true } });
  const writer = createTestWriter(doc);

  const unnamed = bus.execute("entity.create", {}, { author });
  expect(isOk(unnamed)).toBe(true);
  if (!unnamed.ok) {
    return;
  }
  expect(reader.getEntity(unnamed.value.output.id)?.name).toBe("Entity");

  const root = bus.execute("entity.create", { name: "grove" }, { author });
  expect(isOk(root)).toBe(true);
  if (!root.ok) {
    return;
  }
  const afterMissing = bus.execute(
    "entity.create",
    { name: "oak", parent: root.value.output.id, after: unnamed.value.output.id },
    { author },
  );
  expect(isErr(afterMissing) && afterMissing.error.code === "CONFLICT").toBe(true);
  const child = bus.execute(
    "entity.create",
    { name: "oak", parent: { path: "/grove" } },
    { author },
  );
  expect(isOk(child)).toBe(true);
  if (!child.ok) {
    return;
  }
  const dupParentMissing = bus.execute(
    "entity.duplicate",
    { target: child.value.output.id, parent: "e_zzzzzzzzzz" },
    { author },
  );
  expect(isErr(dupParentMissing)).toBe(true);
  const duplicated = bus.execute(
    "entity.duplicate",
    { target: child.value.output.id, parent: root.value.output.id, count: 1 },
    { author },
  );
  expect(isOk(duplicated)).toBe(true);
  const reorderedMissing = bus.execute(
    "entity.reorder",
    { target: child.value.output.id, after: unnamed.value.output.id },
    { author },
  );
  expect(isErr(reorderedMissing)).toBe(true);
  const reparentAfterMissing = bus.execute(
    "entity.setParent",
    { target: child.value.output.id, parent: null, after: "e_zzzzzzzzzz" },
    { author },
  );
  expect(isErr(reparentAfterMissing)).toBe(true);
  const reparentKeep = bus.execute(
    "entity.setParent",
    { target: child.value.output.id, parent: null, keepWorldTransform: false },
    { author },
  );
  expect(isOk(reparentKeep)).toBe(true);
  const strictRename = bus.execute(
    "entity.rename",
    { target: child.value.output.id, name: "Entity", strictName: true },
    { author },
  );
  expect(isErr(strictRename)).toBe(true);

  bus.execute("component.add", { target: child.value.output.id, type: "camera" }, { author });
  const cam = bus.execute("camera.setMain", { target: child.value.output.id }, { author });
  expect(isOk(cam)).toBe(true);
  const missingCam = bus.execute(
    "settings.set",
    { patch: { mainCamera: "e_zzzzzzzzzz" } },
    { author },
  );
  expect(isErr(missingCam)).toBe(true);
  const deletedCam = bus.execute("entity.delete", { target: child.value.output.id }, { author });
  expect(isOk(deletedCam)).toBe(true);
  expect(reader.snapshot().settings.mainCamera).toBeNull();

  const tagged = bus.execute("entity.create", { name: "tagged" }, { author });
  expect(isOk(tagged)).toBe(true);
  if (!tagged.ok) {
    return;
  }
  const tagId = tagged.value.output.id;
  const many = Array.from({ length: 32 }, (_, index) => `t${String(index)}`);
  expect(isOk(bus.execute("tags.add", { target: tagId, tags: many }, { author }))).toBe(true);
  expect(isErr(bus.execute("tags.add", { target: tagId, tags: ["extra"] }, { author }))).toBe(true);
  expect(isOk(bus.execute("tags.add", { target: tagId, tags: ["t0"] }, { author }))).toBe(true);
  expect(isOk(bus.execute("tags.remove", { target: tagId, tags: many }, { author }))).toBe(true);
  expect(reader.getEntity(tagId)?.components.tags).toBeUndefined();

  const keys: Record<string, string> = {};
  for (let index = 0; index < 65; index += 1) {
    keys[`k${String(index)}`] = "v";
  }
  expect(isErr(bus.execute("metadata.set", { target: tagId, patch: keys }, { author }))).toBe(true);

  const built = docBuilder().entity("box", { mesh: "box" }).material("bark").build();
  const geometry = Object.values(built.assets).find((asset) => asset.kind === "geometry");
  const materialAsset = Object.values(built.assets).find((asset) => asset.kind === "material");
  expect(geometry !== undefined && materialAsset !== undefined).toBe(true);
  if (geometry === undefined || materialAsset === undefined) {
    return;
  }
  const { id: _g, createdAt: _gc, ...geomInput } = geometry;
  void _g;
  void _gc;
  const geom = bus.execute("asset.create", { asset: geomInput }, { author });
  expect(isOk(geom)).toBe(true);
  if (!geom.ok) {
    return;
  }
  const renamed = bus.execute(
    "asset.update",
    { target: geom.value.output.id, patch: { name: "crate" } },
    { author },
  );
  expect(isOk(renamed)).toBe(true);

  const importedAt = reader.snapshot().meta.createdAt;
  const envAsset = bus.execute(
    "asset.create",
    {
      asset: {
        kind: "environment",
        name: "hdr",
        license: "unknown",
        provenance: { source: "derived", importedAt },
        source: { kind: "color", color: "#112233" },
      },
    },
    { author },
  );
  expect(isOk(envAsset)).toBe(true);
  if (!envAsset.ok) {
    return;
  }
  expect(
    isOk(
      bus.execute(
        "environment.set",
        { patch: { sky: { kind: "environment", asset: envAsset.value.output.id } } },
        { author },
      ),
    ),
  ).toBe(true);

  const hash = "sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const texture = bus.execute(
    "asset.create",
    {
      asset: {
        kind: "texture",
        name: "albedo",
        license: "unknown",
        provenance: { source: "derived", importedAt },
        blob: { hash, size: 4, mime: "image/png" },
        colorSpace: "srgb",
        size: [1, 1],
        hasAlpha: false,
      },
    },
    { author },
  );
  expect(isOk(texture)).toBe(true);
  if (!texture.ok) {
    return;
  }
  const mat = bus.execute("material.create", { name: "bark", license: "CC0" }, { author });
  expect(isOk(mat)).toBe(true);
  if (!mat.ok) {
    return;
  }
  const slotted = bus.execute(
    "material.set",
    {
      target: mat.value.output.id,
      patch: { baseColorTexture: { texture: texture.value.output.id, texCoord: 0 } },
    },
    { author },
  );
  expect(isOk(slotted)).toBe(true);
  const mesh = bus.execute(
    "entity.create",
    {
      name: "mesh",
      components: {
        meshRenderer: { geometry: geom.value.output.id, materials: [mat.value.output.id] },
      },
    },
    { author },
  );
  expect(isOk(mesh)).toBe(true);
  if (!mesh.ok) {
    return;
  }
  expect(
    isErr(
      bus.execute("material.assign", { target: tagId, material: mat.value.output.id }, { author }),
    ),
  ).toBe(true);
  const assignedSlot = bus.execute(
    "material.assign",
    { target: mesh.value.output.id, material: mat.value.output.id, slot: 2 },
    { author },
  );
  expect(isOk(assignedSlot)).toBe(true);
  const script = bus.execute(
    "asset.create",
    {
      asset: {
        kind: "script",
        name: "spin",
        license: "unknown",
        provenance: { source: "derived", importedAt },
        language: "ts",
        source: "export {}",
        apiVersion: "0.1.0",
      },
    },
    { author },
  );
  expect(isOk(script)).toBe(true);
  if (!script.ok) {
    return;
  }
  expect(
    isOk(
      writer.upsertBehavior({
        id: "b_0000000000",
        name: "spin",
        target: mesh.value.output.id,
        script: script.value.output.id,
        params: {},
        enabled: true,
      }),
    ),
  ).toBe(true);
  expect(reader.getBehavior("b_0000000000")?.script).toBe(script.value.output.id);
  expect(
    isOk(bus.execute("asset.delete", { target: script.value.output.id, force: true }, { author })),
  ).toBe(true);
  expect(reader.getBehavior("b_0000000000")).toBeUndefined();
  expect(
    isOk(bus.execute("asset.delete", { target: texture.value.output.id, force: true }, { author })),
  ).toBe(true);
  expect(
    isOk(
      bus.execute("asset.delete", { target: envAsset.value.output.id, force: true }, { author }),
    ),
  ).toBe(true);
  expect(reader.snapshot().environment.sky.kind).toBe("none");
  expect(
    isOk(bus.execute("asset.delete", { target: mat.value.output.id, force: true }, { author })),
  ).toBe(true);
  expect(isOk(writer.deleteBehavior("b_zzzzzzzzzz"))).toBe(false);

  const worldChild = bus.execute(
    "entity.create",
    {
      name: "mover",
      parent: root.value.output.id,
      components: { transform: { position: [1, 0, 0] } },
    },
    { author },
  );
  expect(isOk(worldChild)).toBe(true);
  if (!worldChild.ok) {
    return;
  }
  expect(
    isOk(
      bus.execute(
        "transform.translate",
        { target: worldChild.value.output.id, delta: [0, 1, 0], space: "world" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "transform.rotate",
        { target: worldChild.value.output.id, delta: [0, 45, 0], space: "world" },
        { author },
      ),
    ),
  ).toBe(true);
  expect(
    isOk(
      bus.execute(
        "transform.rotate",
        { target: worldChild.value.output.id, delta: [0, 400, 0], space: "parent" },
        { author },
      ),
    ),
  ).toBe(true);
});
