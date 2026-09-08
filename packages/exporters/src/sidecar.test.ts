import type { Document, Entity } from "@tessera/schema";
import { ColliderSchema, SidecarSchema } from "@tessera/schema";
import { isOk } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createGltfExporter } from "./gltf.js";
import { GltfExportOptionsSchema } from "./options.js";

function options() {
  return GltfExportOptionsSchema.parse({ outputName: "box", deterministic: true });
}

function primitiveDoc(): Document {
  const built = docBuilder()
    .geometry("box")
    .material("mat", { baseColor: "#8b5a2b" })
    .entity("Box", { mesh: "box", material: "mat" })
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

test("INV-EXP-05 extras id matches sidecar", async () => {
  const document = primitiveDoc();
  const result = await createGltfExporter().export({
    document,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const sidecarFile = result.value.files.find((file) => file.path === "box.tessera.json");
  expect(sidecarFile).toBeDefined();
  if (sidecarFile === undefined) {
    return;
  }
  const sidecar = SidecarSchema.parse(JSON.parse(await sidecarFile.blob.text()));
  expect(sidecar.format).toBe("tessera-sidecar");
  expect(sidecar.version).toBe(1);
  const entity = Object.values(document.entities)[0];
  expect(sidecar.entities[0]?.id).toBe(entity?.id);
  const { Logger, WebIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const glb = result.value.files.find((file) => file.path === "box.glb");
  if (glb === undefined) {
    return;
  }
  const parsed = await new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.SILENT))
    .readBinary(new Uint8Array(await glb.blob.arrayBuffer()));
  const node = parsed.getRoot().listNodes()[0];
  const extras = node?.getExtras() ?? {};
  const tessera = "tessera" in extras ? extras.tessera : undefined;
  expect(typeof tessera === "object" && tessera !== null).toBe(true);
  if (typeof tessera !== "object" || tessera === null || Array.isArray(tessera)) {
    return;
  }
  const record: Record<string, unknown> = tessera;
  expect(record.id).toBe(sidecar.entities[0]?.id);
  expect(sidecar.entities[0]?.nodeIndex).toBe(0);
});
