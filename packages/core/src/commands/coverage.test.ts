import { emptyDocument, entityCreateCommand } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCommandBus } from "../command-bus.js";
import { createDocument } from "../create-document.js";

const author = { kind: "user" as const, id: "tester" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(output: unknown): string | undefined {
  if (!isRecord(output)) {
    return undefined;
  }
  const id = output["id"];
  return typeof id === "string" ? id : undefined;
}

test("covers remaining catalog branches", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc, { blobs: { has: () => true } });

  const root = bus.execute("entity.create", { name: "root" }, { author });
  expect(isOk(root)).toBe(true);
  if (!root.ok) {
    return;
  }
  const rootId = readId(root.value.output);
  expect(rootId !== undefined).toBe(true);
  if (rootId === undefined) {
    return;
  }

  bus.execute("entity.create", { name: "child", parent: { path: "/root" } }, { author });
  const sibling = bus.execute("entity.create", { name: "side", parent: rootId }, { author });
  expect(isOk(sibling)).toBe(true);
  if (!sibling.ok) {
    return;
  }
  const sideId = readId(sibling.value.output);
  expect(sideId !== undefined).toBe(true);
  if (sideId === undefined) {
    return;
  }
  bus.execute("entity.reorder", { target: sideId, after: rootId }, { author });
  bus.execute(
    "entity.setParent",
    { target: sideId, parent: null, keepWorldTransform: false },
    { author },
  );
  bus.execute("entity.rename", { target: sideId, name: "side", strictName: true }, { author });
  bus.execute(
    "transform.translate",
    { target: sideId, delta: [0, 1, 0], space: "local" },
    { author },
  );
  bus.execute(
    "transform.translate",
    { target: sideId, delta: [0, 0, 1], space: "world" },
    { author },
  );
  bus.execute(
    "transform.rotate",
    { target: sideId, delta: [10, 0, 0], space: "local" },
    { author },
  );
  bus.execute(
    "transform.rotate",
    { target: sideId, delta: [0, 10, 0], space: "world" },
    { author },
  );
  bus.execute("transform.scale", { target: sideId, factor: [1.1, 1.1, 1.1] }, { author });
  bus.execute("transform.scale", { target: sideId, factor: -1 }, { author });

  bus.execute(
    "component.add",
    { target: sideId, type: "light", value: { type: "point" } },
    { author },
  );
  bus.execute("component.add", { target: sideId, type: "tags", value: ["prop"] }, { author });
  bus.execute("component.add", { target: sideId, type: "metadata", value: { k: 1 } }, { author });
  bus.execute("component.add", { target: sideId, type: "collider" }, { author });
  bus.execute("component.add", { target: sideId, type: "rigidBody" }, { author });
  bus.execute(
    "component.set",
    { target: sideId, type: "tags", patch: ["prop", "static"] },
    { author },
  );
  bus.execute(
    "component.set",
    { target: sideId, type: "transform", patch: { position: [0, 1, 0] } },
    { author },
  );
  bus.execute(
    "component.set",
    { target: sideId, type: "light", patch: { intensity: 4 } },
    { author },
  );
  bus.execute("component.set", { target: sideId, type: "metadata", patch: { k: 2 } }, { author });
  bus.execute(
    "component.set",
    { target: sideId, type: "collider", patch: { isTrigger: true } },
    { author },
  );
  bus.execute(
    "component.set",
    { target: sideId, type: "rigidBody", patch: { mass: 2 } },
    { author },
  );
  bus.execute("component.remove", { target: sideId, type: "light" }, { author });
  bus.execute("component.remove", { target: sideId, type: "tags" }, { author });
  bus.execute("component.remove", { target: sideId, type: "metadata" }, { author });
  bus.execute("component.remove", { target: sideId, type: "rigidBody" }, { author });
  bus.execute("component.remove", { target: sideId, type: "camera" }, { author });

  const built = docBuilder().entity("box", { mesh: "box" }).build();
  const geometry = Object.values(built.assets)[0];
  expect(geometry !== undefined).toBe(true);
  if (geometry === undefined) {
    return;
  }
  const { id: _id, createdAt: _createdAt, ...geomInput } = geometry;
  void _id;
  void _createdAt;
  const createdGeom = bus.execute("asset.create", { asset: geomInput }, { author });
  expect(isOk(createdGeom)).toBe(true);
  if (!createdGeom.ok) {
    return;
  }
  const geomId = readId(createdGeom.value.output);
  expect(geomId !== undefined).toBe(true);
  if (geomId === undefined) {
    return;
  }
  bus.execute("asset.update", { target: geomId, patch: { kind: "material" } }, { author });
  bus.execute(
    "component.add",
    { target: sideId, type: "meshRenderer", value: { geometry: geomId } },
    { author },
  );
  bus.execute(
    "component.set",
    { target: sideId, type: "meshRenderer", patch: { visible: false } },
    { author },
  );
  const mat = bus.execute("material.create", {}, { author });
  expect(isOk(mat)).toBe(true);
  if (!mat.ok) {
    return;
  }
  const matId = readId(mat.value.output);
  expect(matId !== undefined).toBe(true);
  if (matId === undefined) {
    return;
  }
  bus.execute("material.assign", { target: sideId, material: matId, slot: 0 }, { author });
  bus.execute("material.assign", { target: sideId, material: matId }, { author });

  bus.execute("settings.set", { patch: { mainCamera: null } }, { author });
  bus.execute("settings.set", { patch: { mainCamera: sideId } }, { author });
  bus.execute("environment.set", { patch: { toneMapping: "aces" } }, { author });
  bus.execute(
    "environment.set",
    { patch: { sky: { kind: "color", color: "#000000" } } },
    { author },
  );

  const missingBlob = createCommandBus(doc, { blobs: { has: () => false } });
  expect(
    isErr(
      missingBlob.execute(
        "asset.create",
        {
          asset: {
            ...geomInput,
            name: "blobgeom",
            source: {
              kind: "blob",
              blob: {
                hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                size: 1,
                mime: "model/gltf-binary",
              },
            },
          },
        },
        { author },
      ),
    ),
  ).toBe(true);

  bus.execute("asset.delete", { target: geomId, force: true }, { author });
  bus.execute("component.remove", { target: sideId, type: "meshRenderer" }, { author });
  bus.execute("entity.delete", { target: { path: "/root" } }, { author });
  expect(reader.snapshot().version).toBe("0.1.0");
});

test("transaction join, runId origin, and handler throw restore", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const bus = createCommandBus(doc);
  const joined = bus.transaction({ author, runId: "r_joinjoin01", label: "batch" }, (tx) => {
    const inner = bus.transaction({ author }, (nested) =>
      nested.run("entity.create", { name: "a" }),
    );
    if (!inner.ok) {
      return inner;
    }
    return tx.run("entity.create", { name: "b" });
  });
  expect(isOk(joined)).toBe(true);

  bus.registry.register({
    name: "test.throws",
    description: "throws",
    input: entityCreateCommand.input,
    output: entityCreateCommand.output,
    tier: 1,
    tags: ["mutating"],
    handle() {
      throw new Error("boom");
    },
  });
  const beforeCount = Object.keys(reader.snapshot().entities).length;
  const threw = bus.execute("test.throws", {}, { author });
  expect(isErr(threw) && threw.error.code === "INVARIANT_VIOLATION").toBe(true);
  expect(Object.keys(reader.snapshot().entities).length).toBe(beforeCount);
});
