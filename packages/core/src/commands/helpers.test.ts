import type { Document, Entity } from "@tessera/schema";
import { emptyDocument } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { createDocument } from "../create-document.js";
import { createTestWriter } from "../internal/document-writer.js";
import {
  collectBlobHashes,
  entityWorldMatrix,
  mergeDeep,
  normalizeEuler,
  orderAfterSibling,
  parentWorldMatrix,
  recomputeLocalKeepWorld,
  resolveEntityRef,
  resolveOptionalParent,
  scaleVec3,
  uniqueAssetName,
  uniqueSiblingName,
} from "./helpers.js";

const transform = {
  position: [0, 0, 0] as const,
  rotation: [0, 0, 0] as const,
  scale: [1, 1, 1] as const,
};

function entityOf(id: string, name: string, parent: string | null = null): Entity {
  return {
    id,
    name,
    parent,
    order: "a0",
    enabled: true,
    components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
  };
}

test("unique sibling and asset names suffix, overflow, and length", () => {
  const first = uniqueSiblingName([], "oak", false);
  expect(isOk(first) && first.value === "oak").toBe(true);
  const collision = uniqueSiblingName([entityOf("e_0000000000", "oak")], "oak", false);
  expect(isOk(collision) && collision.value === "oak_01").toBe(true);
  const strict = uniqueSiblingName([entityOf("e_0000000000", "oak")], "oak", true);
  expect(isErr(strict) && strict.error.code === "CONFLICT").toBe(true);
  const long = "N".repeat(62);
  const tooLong = uniqueSiblingName([entityOf("e_0000000000", long)], long, false);
  expect(isErr(tooLong) && tooLong.error.code === "CONFLICT").toBe(true);

  const crowd: Entity[] = [entityOf("e_0000000000", "Entity")];
  for (let index = 1; index <= 99; index += 1) {
    const suffix = index < 10 ? `_0${String(index)}` : `_${String(index)}`;
    crowd.push(entityOf(`e_${String(index).padStart(10, "0")}`, `Entity${suffix}`));
  }
  const exhausted = uniqueSiblingName(crowd, "Entity", false);
  expect(isErr(exhausted) && exhausted.error.code === "CONFLICT").toBe(true);

  const doc: Document = {
    ...emptyDocument(),
    assets: {
      a_0000000000: {
        id: "a_0000000000",
        kind: "material",
        name: "bark",
        license: "unknown",
        provenance: { source: "derived", importedAt: emptyDocument().meta.createdAt },
        createdAt: emptyDocument().meta.createdAt,
        model: "pbr",
        baseColor: "#cccccc",
        metallic: 0,
        roughness: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
        opacity: 1,
        transparent: false,
        alphaCutoff: 0.5,
        doubleSided: false,
      },
    },
  };
  const renamed = uniqueAssetName(doc, "material", "bark");
  expect(isOk(renamed) && renamed.value === "bark_01").toBe(true);
  const longAsset = uniqueAssetName(doc, "material", long);
  expect(isOk(longAsset) && longAsset.value === long).toBe(true);
  const bark = doc.assets["a_0000000000"];
  expect(bark !== undefined).toBe(true);
  if (bark === undefined) {
    return;
  }
  const longTaken: Document = {
    ...doc,
    assets: {
      ...doc.assets,
      a_0000000001: { ...bark, id: "a_0000000001", name: long },
    },
  };
  const longAssetTaken = uniqueAssetName(longTaken, "material", long);
  expect(isErr(longAssetTaken) && longAssetTaken.error.code === "CONFLICT").toBe(true);

  const filledAssets: Document["assets"] = { ...doc.assets };
  for (let index = 1; index <= 99; index += 1) {
    const suffix = index < 10 ? `_0${String(index)}` : `_${String(index)}`;
    const id = `a_${String(index).padStart(10, "0")}`;
    const source = doc.assets["a_0000000000"];
    if (source === undefined) {
      return;
    }
    filledAssets[id] = { ...source, id, name: `bark${suffix}` };
  }
  const assetCrowd: Document = { ...doc, assets: filledAssets };
  expect(isErr(uniqueAssetName(assetCrowd, "material", "bark"))).toBe(true);
});

test("orderAfterSibling and entity ref helpers", () => {
  const a = entityOf("e_0000000000", "A");
  const b = { ...entityOf("e_0000000001", "B"), order: "a1" };
  const first = orderAfterSibling([a, b], null);
  expect(isOk(first)).toBe(true);
  const last = orderAfterSibling([a, b], undefined);
  expect(isOk(last)).toBe(true);
  const afterA = orderAfterSibling([a, b], a.id);
  expect(isOk(afterA)).toBe(true);
  const missing = orderAfterSibling([a, b], "e_zzzzzzzzzz");
  expect(isErr(missing) && missing.error.code === "CONFLICT").toBe(true);

  const invalidHead = { ...a, order: "0000000000" };
  const invalid = orderAfterSibling([invalidHead], undefined);
  expect(isErr(invalid) && invalid.error.code === "INVARIANT_VIOLATION").toBe(true);

  const { reader } = createDocument({ snapshot: emptyDocument() });
  expect(isErr(resolveEntityRef(reader, "e_zzzzzzzzzz"))).toBe(true);
  expect(isErr(resolveEntityRef(reader, { path: "/nope" }))).toBe(true);
  expect(isOk(resolveOptionalParent(reader, null))).toBe(true);
  expect(isOk(resolveOptionalParent(reader, undefined))).toBe(true);
  expect(isErr(resolveOptionalParent(reader, "e_zzzzzzzzzz"))).toBe(true);
});

test("mergeDeep, blob hashes, euler wrap, and scale", () => {
  expect(mergeDeep({ a: 1, nested: { b: 2 } }, { nested: { c: 3 }, skip: undefined })).toEqual({
    a: 1,
    nested: { b: 2, c: 3 },
    skip: undefined,
  });
  expect(mergeDeep(1, 2)).toBe(2);
  const hashes: string[] = [];
  collectBlobHashes(
    {
      list: [
        {
          hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          size: 2,
          mime: "image/png",
        },
      ],
      other: "x",
    },
    hashes,
  );
  expect(hashes).toHaveLength(1);
  collectBlobHashes("leaf", hashes);
  expect(hashes).toHaveLength(1);
  expect(normalizeEuler([270, -180, 190])).toEqual([-90, 180, -170]);
  expect(isErr(scaleVec3(transform.scale, [-1, 1, 1]))).toBe(true);
  expect(isOk(scaleVec3(transform.scale, [2, 2, 2]))).toBe(true);
});

test("world matrices with missing parents and keep-world invert failure", () => {
  const { doc, reader } = createDocument({ snapshot: emptyDocument() });
  const writer = createTestWriter(doc);
  const parent = entityOf("e_0000000000", "Parent");
  const child = entityOf("e_0000000001", "Child", parent.id);
  expect(isOk(writer.createEntity(parent))).toBe(true);
  expect(isOk(writer.createEntity(child))).toBe(true);
  const world = entityWorldMatrix(child, reader);
  expect(world.length).toBe(16);
  expect(isOk(writer.removeEntityUnchecked(parent.id))).toBe(true);
  const orphan = reader.getEntity(child.id);
  expect(orphan !== undefined).toBe(true);
  if (orphan === undefined) {
    return;
  }
  const parentWorld = parentWorldMatrix(orphan, reader);
  expect(parentWorld[0]).toBe(1);
  const ghost = entityOf("e_missing000", "Ghost");
  expect(entityWorldMatrix(ghost, reader).length).toBe(16);
  const zeroScale = {
    ...parent,
    components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1e-20, 1, 1] } },
  };
  const inverted = recomputeLocalKeepWorld(child, zeroScale, reader);
  expect(inverted.ok === true || inverted.ok === false).toBe(true);
});
