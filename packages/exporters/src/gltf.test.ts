import { Logger, WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { isKtx2, KTX2_COLOR_MODEL_ETC1S, ktx2ColorModel, parseGlb } from "@tessera/assets";
import type { Entity, Document as TesseraDocument, TextureAsset } from "@tessera/schema";
import { ColliderSchema, SidecarSchema } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { docBuilder } from "@tessera/testing";
import { validateBytes } from "gltf-validator";
import { expect, test } from "vitest";
import { createGltfExporter } from "./gltf.js";
import { GltfExportOptionsSchema } from "./options.js";

const exporter = createGltfExporter();

function options(overrides: Record<string, unknown> = {}) {
  return GltfExportOptionsSchema.parse({ outputName: "box", deterministic: true, ...overrides });
}

function primitiveDoc(): TesseraDocument {
  const built = docBuilder()
    .geometry("box")
    .material("mat", { baseColor: "#8b5a2b" })
    .entity("Box", {
      mesh: "box",
      material: "mat",
      transform: { position: [1, 2, 3], rotation: [0, 45, 0] },
    })
    .build();
  const entity = Object.values(built.entities)[0];
  if (entity === undefined) {
    return built;
  }
  const tagged: Entity = {
    ...entity,
    components: {
      ...entity.components,
      tags: ["static"],
      collider: ColliderSchema.parse({ shape: "box", fit: "manual", size: [1, 2, 3] }),
    },
  };
  return { ...built, entities: { ...built.entities, [entity.id]: tagged } };
}

async function glbBytes(document: TesseraDocument, blobs = new MemoryBlobStore()) {
  const result = await exporter.export({ document, blobs, options: options() });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return new Uint8Array();
  }
  const glb = result.value.files.find((file) => file.path.endsWith(".glb"));
  expect(glb).toBeDefined();
  if (glb === undefined) {
    return new Uint8Array();
  }
  return new Uint8Array(await glb.blob.arrayBuffer());
}

test("INV-EXP-03 gltf-validator primitives", async () => {
  const bytes = await glbBytes(primitiveDoc());
  const report = await validateBytes(bytes);
  expect(report.issues.numErrors).toBe(0);
});

test("INV-EXP-02 deterministic byte-identical", async () => {
  const document = primitiveDoc();
  const blobs = new MemoryBlobStore();
  const first = await exporter.export({ document, blobs, options: options() });
  const second = await exporter.export({ document, blobs, options: options() });
  expect(isOk(first) && isOk(second)).toBe(true);
  if (!first.ok || !second.ok) {
    return;
  }
  const a = first.value.files.find((file) => file.path === "box.glb");
  const b = second.value.files.find((file) => file.path === "box.glb");
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  if (a === undefined || b === undefined) {
    return;
  }
  const left = new Uint8Array(await a.blob.arrayBuffer());
  const right = new Uint8Array(await b.blob.arrayBuffer());
  expect(left).toEqual(right);
  expect(first.value.files.some((file) => file.path.endsWith(".tessera.json"))).toBe(true);
  const sidecarFile = first.value.files.find((file) => file.path.endsWith(".tessera.json"));
  if (sidecarFile === undefined) {
    return;
  }
  const sidecar = SidecarSchema.parse(JSON.parse(await sidecarFile.blob.text()));
  expect(sidecar.exportedAt).toBeUndefined();
});

test("cancelled export returns CANCELLED", async () => {
  const result = await exporter.export(
    { document: primitiveDoc(), blobs: new MemoryBlobStore(), options: options() },
    AbortSignal.abort(),
  );
  expect(isErr(result) && result.error.code === "CANCELLED").toBe(true);
});

test("export textures ktx2 encodes KTX2", async () => {
  const blobs = new MemoryBlobStore();
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde,
  ]);
  const written = await blobs.write(png, "image/png", "albedo.png");
  expect(written.ok).toBe(true);
  if (!written.ok) {
    return;
  }
  const built = primitiveDoc();
  const mat = Object.values(built.assets).find((asset) => asset.kind === "material");
  if (mat === undefined || mat.kind !== "material") {
    return;
  }
  const texId = "a_texktx0000";
  const texture: TextureAsset = {
    id: texId,
    name: "albedo",
    license: "CC0-1.0",
    provenance: { source: "upload", importedAt: built.meta.createdAt },
    createdAt: built.meta.createdAt,
    kind: "texture",
    blob: written.value,
    colorSpace: "srgb",
    wrapS: "repeat",
    wrapT: "repeat",
    size: [2, 2],
    hasAlpha: false,
  };
  const document: TesseraDocument = {
    ...built,
    assets: {
      ...built.assets,
      [texId]: texture,
      [mat.id]: {
        ...mat,
        baseColorTexture: {
          texture: texId,
          texCoord: 0,
          scale: [1, 1],
          offset: [0, 0],
          rotation: 0,
        },
      },
    },
  };
  const ktx2 = await exporter.export({
    document,
    blobs,
    options: options({ textures: "ktx2" }),
  });
  expect(isOk(ktx2)).toBe(true);
  if (!ktx2.ok) {
    return;
  }
  const glbFile = ktx2.value.files.find((file) => file.path.endsWith(".glb"));
  expect(glbFile !== undefined).toBe(true);
  if (glbFile === undefined) {
    return;
  }
  const bytes = new Uint8Array(await glbFile.blob.arrayBuffer());
  const parsed = parseGlb(bytes);
  expect(parsed.json.extensionsUsed?.includes("KHR_texture_basisu")).toBe(true);
  const image = parsed.json.images?.[0];
  expect(image?.mimeType).toBe("image/ktx2");
  const viewIndex = image?.bufferView;
  expect(typeof viewIndex).toBe("number");
  if (viewIndex === undefined) {
    return;
  }
  const view = parsed.json.bufferViews?.[viewIndex];
  expect(view !== undefined).toBe(true);
  if (view === undefined) {
    return;
  }
  const start = view.byteOffset ?? 0;
  const imageBytes = parsed.bin.subarray(start, start + view.byteLength);
  expect(isKtx2(imageBytes)).toBe(true);
  expect(ktx2ColorModel(imageBytes)).toBe(KTX2_COLOR_MODEL_ETC1S);
});

test("export compression draco encodes Draco", async () => {
  const document = primitiveDoc();
  const draco = await exporter.export({
    document,
    blobs: new MemoryBlobStore(),
    options: options({ compression: "draco" }),
  });
  expect(isOk(draco)).toBe(true);
  if (!draco.ok) {
    return;
  }
  const glbFile = draco.value.files.find((file) => file.path.endsWith(".glb"));
  expect(glbFile !== undefined).toBe(true);
  if (glbFile === undefined) {
    return;
  }
  const parsed = parseGlb(new Uint8Array(await glbFile.blob.arrayBuffer()));
  expect(parsed.json.extensionsUsed?.includes("KHR_draco_mesh_compression")).toBe(true);
  const primitive = parsed.json.meshes?.[0]?.primitives[0];
  const ext = primitive?.extensions;
  expect(ext !== undefined && Object.hasOwn(ext, "KHR_draco_mesh_compression")).toBe(true);
  const payload =
    ext === undefined
      ? undefined
      : (ext as { KHR_draco_mesh_compression?: { bufferView?: number } })
          .KHR_draco_mesh_compression;
  const viewIndex = payload?.bufferView;
  expect(typeof viewIndex).toBe("number");
  if (viewIndex === undefined) {
    return;
  }
  expect(parsed.json.bufferViews?.[viewIndex] !== undefined).toBe(true);
  expect(JSON.stringify(parsed.json).includes("tesseraCompression")).toBe(false);
});

test("meshopt remains UNSUPPORTED", async () => {
  const meshopt = await exporter.export({
    document: primitiveDoc(),
    blobs: new MemoryBlobStore(),
    options: options({ compression: "meshopt" }),
  });
  expect(isErr(meshopt) && meshopt.error.code === "UNSUPPORTED").toBe(true);
});

test("CC-BY attribution is included and CC0 is omitted", async () => {
  const cc0 = primitiveDoc();
  const none = await exporter.export({
    document: cc0,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isOk(none)).toBe(true);
  if (none.ok) {
    expect(none.value.files.some((file) => file.path === "ATTRIBUTIONS.md")).toBe(false);
  }
  const entity = Object.values(cc0.entities)[0];
  const geoId = entity?.components.meshRenderer?.geometry;
  const geo = geoId === undefined ? undefined : cc0.assets[geoId];
  if (geo === undefined || entity === undefined) {
    return;
  }
  const licensed = {
    ...cc0,
    assets: {
      ...cc0.assets,
      [geo.id]: {
        ...geo,
        license: "CC-BY-4.0",
        provenance: {
          ...geo.provenance,
          author: "Ada",
          sourceUrl: "https://example.com/oak",
        },
      },
    },
  };
  const withBy = await exporter.export({
    document: licensed,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isOk(withBy)).toBe(true);
  if (!withBy.ok) {
    return;
  }
  expect(withBy.value.files.some((file) => file.path === "ATTRIBUTIONS.md")).toBe(true);
  expect(withBy.value.attribution?.includes("CC-BY-4.0")).toBe(true);
});

test("exported glTF extras carry tessera id", async () => {
  const document = primitiveDoc();
  const bytes = await glbBytes(document);
  const parsed = await new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .readBinary(bytes);
  const node = parsed.getRoot().listNodes()[0];
  const extras = node?.getExtras() ?? {};
  const tessera = extras.tessera;
  expect(typeof tessera === "object" && tessera !== null && !Array.isArray(tessera)).toBe(true);
  if (typeof tessera !== "object" || tessera === null || Array.isArray(tessera)) {
    return;
  }
  const original = Object.values(document.entities)[0];
  expect(tessera.id).toBe(original?.id);
});
