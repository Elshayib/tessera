import { Logger, WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { Entity, Document as TesseraDocument } from "@tessera/schema";
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

test("ktx2 and draco are UNSUPPORTED", async () => {
  const document = primitiveDoc();
  const blobs = new MemoryBlobStore();
  const ktx2 = await exporter.export({
    document,
    blobs,
    options: options({ textures: "ktx2" }),
  });
  expect(isErr(ktx2) && ktx2.error.code === "UNSUPPORTED").toBe(true);
  const draco = await exporter.export({
    document,
    blobs,
    options: options({ compression: "draco" }),
  });
  expect(isErr(draco) && draco.error.code === "UNSUPPORTED").toBe(true);
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
