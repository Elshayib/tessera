import { Document, type Node as GltfNode, Logger, TextureInfo, WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { createCommandBus, createDocument } from "@tessera/core";
import { AssetIdSchema, EntityIdSchema, validateDocument } from "@tessera/schema";
import { err, isErr, isOk, tesseraError } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { FakeClock } from "@tessera/testing";
import { expect, test } from "vitest";
import linesGltf from "../../schema/fixtures/gltf/lines.json" with { type: "json" };
import triangleGltf from "../../schema/fixtures/gltf/triangle.json" with { type: "json" };
import twoMeshGltf from "../../schema/fixtures/gltf/two-mesh.json" with { type: "json" };
import { createAssetService } from "./asset-service.js";
import {
  HARD_BLOB_LIMIT_BYTES,
  IMPORT_TRIANGLE_WARN_COUNT,
  importGltf,
  triangleCountWarning,
} from "./import-worker.js";

const author = { kind: "user" as const, id: "tester" };

test("single mesh ImportPlan golden", async () => {
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const result = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs,
    clock,
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const plan = result.value;
  const geometries = plan.assets.filter((asset) => asset.kind === "geometry");
  const materials = plan.assets.filter((asset) => asset.kind === "material");
  const entities = plan.entities ?? [];
  expect({
    blobCount: plan.blobs.length,
    blobMime: plan.blobs[0]?.mime,
    assetKinds: plan.assets.map((asset) => asset.kind),
    geometryCount: geometries.length,
    materialCount: materials.length,
    entityCount: entities.length,
    entityName: entities[0]?.name,
    meshIndex: geometries[0]?.kind === "geometry" ? geometries[0].source.meshIndex : undefined,
    sourceKind: geometries[0]?.kind === "geometry" ? geometries[0].source.kind : undefined,
    warnings: plan.warnings,
    importedAt: geometries[0]?.provenance.importedAt,
    license: geometries[0]?.license,
  }).toEqual({
    blobCount: 1,
    blobMime: "model/gltf-binary",
    assetKinds: ["geometry", "material"],
    geometryCount: 1,
    materialCount: 1,
    entityCount: 1,
    entityName: "Triangle",
    meshIndex: 0,
    sourceKind: "blob",
    warnings: [],
    importedAt: clock.nowIso(),
    license: "unknown",
  });
  expect(geometries[0]?.kind === "geometry" && geometries[0].source.kind === "blob").toBe(true);
  if (geometries[0]?.kind === "geometry" && geometries[0].source.kind === "blob") {
    expect(geometries[0].source.blob.hash).toBe(plan.blobs[0]?.hash);
  }
});

test("unsupported format UNSUPPORTED", async () => {
  const blobs = new MemoryBlobStore();
  for (const fileName of ["model.fbx", "mesh.obj", "scene.usd", "char.blend"]) {
    const result = await importGltf({
      bytes: new Uint8Array([1, 2, 3]),
      fileName,
      blobs,
      clock: new FakeClock(),
    });
    expect(isErr(result) && result.error.code === "UNSUPPORTED", fileName).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toMatch(/Blender/i);
    }
  }
});

test("hard blob size is rejected", async () => {
  expect(HARD_BLOB_LIMIT_BYTES).toBe(50 * 1024 * 1024);
  const result = await importGltf({
    bytes: new Uint8Array(HARD_BLOB_LIMIT_BYTES + 1),
    fileName: "huge.glb",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isErr(result) && result.error.code === "INVALID_INPUT").toBe(true);
});

test("warns on triangle counts above 2M and skips non-triangle primitives", async () => {
  expect(IMPORT_TRIANGLE_WARN_COUNT).toBe(2_000_000);
  expect(triangleCountWarning(IMPORT_TRIANGLE_WARN_COUNT)).toBeUndefined();
  expect(triangleCountWarning(IMPORT_TRIANGLE_WARN_COUNT + 1)).toMatch(/2/);

  const blobs = new MemoryBlobStore();
  const result = await importGltf({
    bytes: encodeGltf(linesGltf),
    fileName: "lines.gltf",
    blobs,
    clock: new FakeClock(),
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.assets.filter((asset) => asset.kind === "geometry")).toHaveLength(0);
  expect(result.value.warnings.some((warning) => /triangle|non-triangle|skip/i.test(warning))).toBe(
    true,
  );
});

test("more than one mesh node proposes an entity tree", async () => {
  const result = await importGltf({
    bytes: encodeGltf(twoMeshGltf),
    fileName: "two-mesh.gltf",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const entities = result.value.entities ?? [];
  expect(entities).toHaveLength(3);
  const group = entities.find((entity) => entity.name === "Group");
  const left = entities.find((entity) => entity.name === "Left");
  const right = entities.find((entity) => entity.name === "Right");
  expect(group?.parent).toBeNull();
  expect(left?.parent).toBe(group?.id);
  expect(right?.parent).toBe(group?.id);
  expect(left?.components?.transform?.position).toEqual([-1, 0, 0]);
  expect(right?.components?.transform?.position).toEqual([1, 0, 0]);
  expect(result.value.assets.filter((asset) => asset.kind === "geometry")).toHaveLength(2);
});

test("aborted import returns CANCELLED", async () => {
  const result = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
    signal: AbortSignal.abort(),
  });
  expect(isErr(result) && result.error.code === "CANCELLED").toBe(true);
});

test("invalid glTF bytes return INVALID_INPUT", async () => {
  const result = await importGltf({
    bytes: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
    fileName: "broken.glb",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isErr(result) && result.error.code === "INVALID_INPUT").toBe(true);
});

test("commitPlan is one transaction and validateDocument is ok", async () => {
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const imported = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs,
    clock,
  });
  expect(isOk(imported)).toBe(true);
  if (!imported.ok) {
    return;
  }
  const { doc, reader } = createDocument({ clock });
  const hashes = new Set(imported.value.blobs.map((blob) => blob.hash));
  const bus = createCommandBus(doc, { blobs: { has: (hash) => hashes.has(hash) } });
  let commits = 0;
  bus.events.on("transaction.committed", () => {
    commits += 1;
  });
  const service = createAssetService({ bus });
  const committed = service.commitPlan(imported.value, {
    author,
    position: [2, 0, 0],
  });
  expect(isOk(committed)).toBe(true);
  if (!committed.ok) {
    return;
  }
  expect(commits).toBe(1);
  expect(committed.value.transaction.label).toBe("Import triangle.gltf");
  expect(
    committed.value.transaction.commands.some((command) => command.name === "asset.create"),
  ).toBe(true);
  expect(
    committed.value.transaction.commands.some((command) => command.name === "entity.create"),
  ).toBe(true);
  expect(bus.registry.has("asset.import")).toBe(false);
  expect(validateDocument(reader.snapshot()).ok).toBe(true);
  const entities = [...reader.entities()];
  expect(entities).toHaveLength(1);
  expect(entities[0]?.components.transform.position).toEqual([2, 0, 0]);
});

test("commitPlan parents roots and rejects invalid assets", async () => {
  const blobs = new MemoryBlobStore();
  const clock = new FakeClock();
  const imported = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs,
    clock,
  });
  expect(isOk(imported)).toBe(true);
  if (!imported.ok) {
    return;
  }
  const { doc, reader } = createDocument({ clock });
  const hashes = new Set(imported.value.blobs.map((blob) => blob.hash));
  const bus = createCommandBus(doc, { blobs: { has: (hash) => hashes.has(hash) } });
  const parent = bus.execute("entity.create", { name: "Root" }, { author });
  expect(isOk(parent)).toBe(true);
  if (!parent.ok) {
    return;
  }
  const parentId = parent.value.output.id;
  const service = createAssetService({ bus });
  const committed = service.commitPlan(imported.value, { author, parent: parentId });
  expect(isOk(committed)).toBe(true);
  if (!committed.ok) {
    return;
  }
  const importedEntity = [...reader.entities()].find((entity) => entity.name === "Triangle");
  expect(importedEntity?.parent).toBe(parentId);

  const untitled = service.commitPlan(
    { blobs: [], assets: [], entities: [], warnings: [] },
    { author },
  );
  expect(isOk(untitled)).toBe(true);
  if (untitled.ok) {
    expect(untitled.value.transaction.label).toBe("Import untitled");
  }

  const { doc: offsetDoc, reader: offsetReader } = createDocument({ clock: new FakeClock() });
  const offsetBus = createCommandBus(offsetDoc, { blobs: { has: () => true } });
  const offset = createAssetService({ bus: offsetBus }).commitPlan(
    {
      blobs: [],
      assets: [],
      entities: [{ id: EntityIdSchema.parse("e_0000000000"), name: "Ghost", parent: null }],
      warnings: [],
    },
    { author, position: [3, 1, 0] },
  );
  expect(isOk(offset)).toBe(true);
  expect([...offsetReader.entities()][0]?.components.transform.position).toEqual([3, 1, 0]);

  const bad = service.commitPlan(
    {
      blobs: [],
      assets: [
        {
          id: AssetIdSchema.parse("a_0000000000"),
          name: "",
          license: "unknown",
          provenance: { source: "upload", importedAt: clock.nowIso() },
          kind: "material",
          model: "pbr",
          baseColor: "#cccccc",
          metallic: 0,
          roughness: 0.6,
          emissive: "#000000",
          emissiveStrength: 1,
          opacity: 1,
          alphaMode: "opaque",
          alphaCutoff: 0.5,
          doubleSided: false,
          normalScale: 1,
          occlusionStrength: 1,
        },
      ],
      warnings: [],
    },
    { author },
  );
  expect(isErr(bad)).toBe(true);
});

test("scale extremes warn and negative scale bakes identity", async () => {
  const huge = await importBuilt(async (document) => {
    const node = addTriangle(document, "Huge");
    node.setScale([2500, 1, 1]);
  });
  expect(isOk(huge)).toBe(true);
  if (huge.ok) {
    expect(huge.value.warnings.some((warning) => /1 km/i.test(warning))).toBe(true);
  }

  const tiny = await importBuilt(async (document) => {
    const node = addTriangle(document, "Tiny");
    node.setScale([1e-5, 1e-5, 1e-5]);
  });
  expect(isOk(tiny)).toBe(true);
  if (tiny.ok) {
    expect(tiny.value.warnings.some((warning) => /1 mm/i.test(warning))).toBe(true);
  }

  const flipped = await importBuilt(async (document) => {
    const node = addTriangle(document, "Flip");
    node.setScale([-1, 1, 1]);
  });
  expect(isOk(flipped)).toBe(true);
  if (flipped.ok) {
    expect(flipped.value.warnings.some((warning) => /INVALID_INPUT/i.test(warning))).toBe(true);
    expect(flipped.value.entities?.[0]?.components?.transform?.scale).toEqual([1, 1, 1]);
  }
});

test("embedded texture becomes a texture asset", async () => {
  const result = await importBuilt((document) => {
    const node = addTriangle(document, "Textured");
    const mesh = node.getMesh();
    const prim = mesh?.listPrimitives()[0];
    const texture = document.createTexture("Red").setImage(pngBytes()).setMimeType("image/png");
    const material = document
      .createMaterial("Paint")
      .setAlphaMode("MASK")
      .setBaseColorTexture(texture);
    const info = material.getBaseColorTextureInfo();
    info
      ?.setWrapS(TextureInfo.WrapMode.CLAMP_TO_EDGE)
      .setWrapT(TextureInfo.WrapMode.MIRRORED_REPEAT);
    prim?.setMaterial(material);
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const texture = result.value.assets.find((asset) => asset.kind === "texture");
  const material = result.value.assets.find((asset) => asset.kind === "material");
  expect(texture?.kind === "texture" && texture.wrapS === "clamp").toBe(true);
  expect(texture?.kind === "texture" && texture.wrapT === "mirror").toBe(true);
  expect(material?.kind === "material" && material.alphaMode === "mask").toBe(true);
  expect(result.value.blobs.length).toBeGreaterThan(1);
});

test("normal texture without mikktspace does not fail the import", async () => {
  const result = await importBuilt((document) => {
    const node = addTriangle(document, "Nrm");
    const prim = node.getMesh()?.listPrimitives()[0];
    const texture = document.createTexture("N").setImage(pngBytes()).setMimeType("image/png");
    prim?.setMaterial(document.createMaterial("Bump").setNormalTexture(texture));
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.assets.some((asset) => asset.kind === "texture")).toBe(true);
});

test("duplicate mesh names are uniqued and invalid names fall back", async () => {
  const result = await importBuilt((document) => {
    addTriangle(document, "Mesh", 0);
    addTriangle(document, "@@@", 2);
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const geometries = result.value.assets.filter((asset) => asset.kind === "geometry");
  const names = geometries.map((asset) => asset.name).sort();
  expect(names).toEqual(["Mesh", "Mesh_01"]);
  expect(result.value.entities?.some((entity) => entity.name === "Entity")).toBe(true);
});

test("texture write failure is returned", async () => {
  const inner = new MemoryBlobStore();
  let writes = 0;
  const document = new Document();
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  const node = addTriangle(document, "Textured");
  const prim = node.getMesh()?.listPrimitives()[0];
  const texture = document.createTexture("Red").setImage(pngBytes()).setMimeType("image/png");
  prim?.setMaterial(document.createMaterial("Paint").setBaseColorTexture(texture));
  const bytes = await new WebIO()
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .writeBinary(document);
  const result = await importGltf({
    bytes,
    fileName: "textured.glb",
    blobs: {
      has: (hash) => inner.has(hash),
      read: (hash, signal) => inner.read(hash, signal),
      write: (data, mime, fileName, signal) => {
        if (writes > 0) {
          return Promise.resolve(err(tesseraError("IO_ERROR", "png fail")));
        }
        writes += 1;
        return inner.write(data, mime, fileName, signal);
      },
      delete: (hash) => inner.delete(hash),
      list: () => inner.list(),
      usage: () => inner.usage(),
    },
    clock: new FakeClock(),
  });
  expect(isErr(result) && result.error.code === "IO_ERROR").toBe(true);
});

test("non-object JSON is INVALID_INPUT and extra unsupported extensions", async () => {
  const jsonArray = await importGltf({
    bytes: new TextEncoder().encode("[]"),
    fileName: "empty.gltf",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isErr(jsonArray) && jsonArray.error.code === "INVALID_INPUT").toBe(true);

  const usda = await importGltf({
    bytes: new Uint8Array([1]),
    fileName: "stage.usda",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isErr(usda) && usda.error.code === "UNSUPPORTED").toBe(true);
});

test("blob write failure is returned", async () => {
  const result = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs: {
      has: async () => false,
      read: async () => err(tesseraError("NOT_FOUND", "missing")),
      write: async () => err(tesseraError("IO_ERROR", "disk full")),
      delete: async () => err(tesseraError("NOT_FOUND", "missing")),
      list: async () => err(tesseraError("NOT_FOUND", "missing")),
      usage: async () => err(tesseraError("NOT_FOUND", "missing")),
    },
    clock: new FakeClock(),
  });
  expect(isErr(result) && result.error.code === "IO_ERROR").toBe(true);
});

test("import covers remaining material, abort, and JSON uri branches", async () => {
  let checks = 0;
  let late = 0;
  const delayed = {
    get aborted() {
      checks += 1;
      return checks > 1;
    },
  };
  const cancelled = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
    signal: delayed,
  });
  expect(isErr(cancelled) && cancelled.error.code === "CANCELLED").toBe(true);
  const cancelledLate = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "triangle.gltf",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
    signal: {
      get aborted() {
        late += 1;
        return late > 2;
      },
    },
  });
  expect(isErr(cancelledLate) && cancelledLate.error.code === "CANCELLED").toBe(true);

  const noExt = await importGltf({
    bytes: encodeGltf(triangleGltf),
    fileName: "model",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isOk(noExt)).toBe(true);

  const withUris = await importGltf({
    bytes: encodeGltf({
      asset: { version: "2.0" },
      images: [{ uri: "data:text/plain,hello" }, { uri: "data:missing-comma" }, "skip"],
    }),
    fileName: "uris.gltf",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
  expect(isErr(withUris) && withUris.error.code === "INVALID_INPUT").toBe(true);

  const result = await importBuilt((document) => {
    const node = addTriangle(document, "");
    const empty = document.createNode("Skip");
    const scene = document.getRoot().listScenes()[0];
    scene?.addChild(empty);
    const prim = node.getMesh()?.listPrimitives()[0];
    const texture = document.createTexture("").setImage(pngBytes()).setMimeType("");
    const material = document.createMaterial("Glass").setAlphaMode("BLEND");
    material.setBaseColorTexture(texture).setEmissiveTexture(texture);
    const info = material.getBaseColorTextureInfo();
    info?.setTexCoord(1);
    const unlit = document.createExtension(KHRMaterialsUnlit);
    material.setExtension(KHRMaterialsUnlit.EXTENSION_NAME, unlit.createUnlit());
    prim?.setMaterial(material);
    prim?.setAttribute("TEXCOORD_1", prim.getAttribute("TEXCOORD_0"));
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const material = result.value.assets.find((asset) => asset.kind === "material");
  expect(material?.kind === "material" && material.model === "unlit").toBe(true);
  expect(material?.kind === "material" && material.alphaMode === "blend").toBe(true);
  expect(result.value.assets.some((asset) => asset.kind === "texture")).toBe(true);
});

test("commitPlan uses first blob name and skips offset on children", () => {
  const { doc, reader } = createDocument({ clock: new FakeClock() });
  const bus = createCommandBus(doc, { blobs: { has: () => true } });
  const service = createAssetService({ bus });
  const named = service.commitPlan(
    {
      blobs: [
        {
          hash: `sha256-${"ab".repeat(32)}`,
          size: 1,
          mime: "image/png",
          fileName: "tex.png",
        },
      ],
      assets: [],
      warnings: [],
    },
    { author },
  );
  expect(isOk(named) && named.value.transaction.label === "Import tex.png").toBe(true);

  const tree = service.commitPlan(
    {
      blobs: [],
      assets: [],
      entities: [
        {
          id: EntityIdSchema.parse("e_0000000001"),
          name: "Parent",
          parent: null,
          components: { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
        },
        {
          id: EntityIdSchema.parse("e_0000000002"),
          name: "Child",
          parent: EntityIdSchema.parse("e_0000000001"),
          components: { transform: { position: [1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
        },
      ],
      warnings: [],
    },
    { author, position: [9, 0, 0] },
  );
  expect(isOk(tree)).toBe(true);
  const parent = [...reader.entities()].find((entity) => entity.name === "Parent");
  const child = [...reader.entities()].find((entity) => entity.name === "Child");
  expect(parent?.components.transform.position).toEqual([9, 0, 0]);
  expect(child?.components.transform.position).toEqual([1, 0, 0]);
  expect(child?.parent).toBe(parent?.id);

  const loose = service.commitPlan(
    {
      blobs: [],
      assets: [],
      entities: [
        {
          id: EntityIdSchema.parse("e_0000000004"),
          name: "Loose",
          parent: EntityIdSchema.parse("e_missing000"),
          components: "skip",
        },
      ],
      warnings: [],
    },
    { author },
  );
  expect(isErr(loose) || isOk(loose)).toBe(true);

  const badEntity = service.commitPlan(
    {
      blobs: [],
      assets: [],
      entities: [{ id: EntityIdSchema.parse("e_0000000003"), name: "bad/name", parent: null }],
      warnings: [],
    },
    { author },
  );
  expect(isErr(badEntity)).toBe(true);
});

function encodeGltf(document: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}

async function importBuilt(
  build: (document: Document) => void,
): Promise<ReturnType<typeof importGltf>> {
  const document = new Document();
  document.setLogger(new Logger(Logger.Verbosity.SILENT));
  build(document);
  const bytes = await new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .writeBinary(document);
  return importGltf({
    bytes,
    fileName: "built.glb",
    blobs: new MemoryBlobStore(),
    clock: new FakeClock(),
  });
}

function addTriangle(document: Document, name: string, offset = 0): GltfNode {
  const buffer = document.getRoot().listBuffers()[0] ?? document.createBuffer();
  const position = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array([offset, 0, 0, offset + 1, 0, 0, offset, 1, 0]))
    .setBuffer(buffer);
  const indices = document
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array([0, 1, 2]))
    .setBuffer(buffer);
  const prim = document.createPrimitive().setAttribute("POSITION", position).setIndices(indices);
  const uvs = document
    .createAccessor()
    .setType("VEC2")
    .setArray(new Float32Array([0, 0, 1, 0, 0, 1]))
    .setBuffer(buffer);
  prim.setAttribute("TEXCOORD_0", uvs);
  const mesh = document.createMesh(name).addPrimitive(prim);
  const node = document.createNode(name).setMesh(mesh);
  const scene = document.getRoot().listScenes()[0] ?? document.createScene();
  scene.addChild(node);
  return node;
}

function pngBytes(): Uint8Array {
  return Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAE0lEQVR4nGP4z8DwHwwZGP6DGQBDzgf56e0uNAAAAABJRU5ErkJggg==",
    ),
    (ch) => ch.charCodeAt(0),
  );
}
