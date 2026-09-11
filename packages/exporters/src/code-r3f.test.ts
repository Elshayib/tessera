import { CameraSchema, type Document, type Entity, LightSchema } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCodeR3fExporter } from "./code-r3f.js";
import { GltfExportOptionsSchema } from "./options.js";

const exporter = createCodeR3fExporter();

function options(overrides: Record<string, unknown> = {}) {
  return GltfExportOptionsSchema.parse({
    outputName: "scene",
    deterministic: true,
    ...overrides,
  });
}

function primitiveDoc(): Document {
  return docBuilder()
    .geometry("box")
    .material("mat", { baseColor: "#8b5a2b" })
    .entity("Box", { mesh: "box", material: "mat" })
    .build();
}

async function sceneTsx(document: Document, blobs = new MemoryBlobStore()): Promise<string> {
  const result = await exporter.export({ document, blobs, options: options() });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return "";
  }
  const file = result.value.files.find((entry) => entry.path === "Scene.tsx");
  expect(file).toBeDefined();
  if (file === undefined) {
    return "";
  }
  return file.blob.text();
}

test("code-r3f snapshot", async () => {
  const source = await sceneTsx(primitiveDoc());
  await expect(source).toMatchFileSnapshot("../fixtures/code-r3f/Scene.tsx");
});

test("Scene.tsx mentions useGLTF and Environment", async () => {
  const source = await sceneTsx(primitiveDoc());
  expect(source.includes("useGLTF")).toBe(true);
  expect(source.includes("Environment")).toBe(true);
  expect(source.includes("modelUrl")).toBe(true);
  expect(exporter.id).toBe("code-r3f");
  expect(exporter.fileExtensions.includes("tsx")).toBe(true);
  expect(source.startsWith("/**")).toBe(true);
  expect(source.includes("tessera@")).toBe(true);
  expect(source.includes("Asset licenses:")).toBe(true);
});

test("code-r3f is deterministic and covers area lights, cameras, and HDR", async () => {
  const built = primitiveDoc();
  const panel: Entity = {
    id: "e_area000000",
    name: "Panel",
    parent: null,
    order: "a1",
    enabled: true,
    components: {
      transform: { position: [0, 2, 0], rotation: [90, 0, 0], scale: [1, 1, 1] },
      light: LightSchema.parse({ type: "area", color: "#ffeecc", intensity: 5, size: [2, 1] }),
    },
  };
  const cam: Entity = {
    id: "e_cam0000000",
    name: "Cam",
    parent: null,
    order: "a2",
    enabled: true,
    components: {
      transform: { position: [0, 1.6, 4], rotation: [0, 180, 0], scale: [1, 1, 1] },
      camera: CameraSchema.parse({ type: "orthographic", orthoSize: 3 }),
    },
  };
  const document: Document = {
    ...built,
    settings: { ...built.settings, mainCamera: cam.id },
    entities: { ...built.entities, [panel.id]: panel, [cam.id]: cam },
  };
  const blobs = new MemoryBlobStore();
  const first = await exporter.export({ document, blobs, options: options() });
  const second = await exporter.export({ document, blobs, options: options() });
  expect(isOk(first) && isOk(second)).toBe(true);
  if (!first.ok || !second.ok) {
    return;
  }
  const a = first.value.files.find((file) => file.path === "Scene.tsx");
  const b = second.value.files.find((file) => file.path === "Scene.tsx");
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  if (a === undefined || b === undefined) {
    return;
  }
  expect(await a.blob.text()).toBe(await b.blob.text());
  const source = await a.blob.text();
  expect(source.includes("rectAreaLight")).toBe(true);
  expect(source.includes("OrthographicCamera")).toBe(true);
  const omitted = await exporter.export({
    document,
    blobs,
    options: options({ includeCameras: false, includeLights: false }),
  });
  expect(isOk(omitted)).toBe(true);
  if (omitted.ok) {
    const tsx = omitted.value.files.find((file) => file.path === "Scene.tsx");
    if (tsx !== undefined) {
      const text = await tsx.blob.text();
      expect(text.includes("rectAreaLight")).toBe(false);
      expect(text.includes("PerspectiveCamera")).toBe(true);
    }
  }
  const perspDoc: Document = {
    ...built,
    entities: {
      ...built.entities,
      e_cam0000000: {
        id: "e_cam0000000",
        name: "Lens",
        parent: null,
        order: "a3",
        enabled: true,
        components: {
          transform: { position: [0, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
          camera: CameraSchema.parse({ type: "perspective", fov: 60 }),
        },
      },
    },
  };
  const persp = await sceneTsx(perspDoc);
  expect(persp.includes("fov={60}")).toBe(true);
  const hdrBlobs = new MemoryBlobStore();
  const written = await hdrBlobs.write(
    new Uint8Array([1, 2, 3, 4]),
    "image/vnd.radiance",
    "sky.hdr",
  );
  expect(isOk(written)).toBe(true);
  if (!written.ok) {
    return;
  }
  const envId = "a_env0000000";
  const hdriDoc: Document = {
    ...built,
    assets: {
      ...built.assets,
      [envId]: {
        id: envId,
        name: "Sky",
        license: "CC-BY-4.0",
        provenance: { source: "polyhaven", importedAt: built.meta.createdAt },
        createdAt: built.meta.createdAt,
        kind: "environment",
        source: { kind: "hdri", blob: written.value },
        rotation: 15,
        intensity: 1.2,
      },
    },
    environment: {
      ...built.environment,
      sky: { kind: "environment", asset: envId },
    },
  };
  const hdri = await exporter.export({
    document: hdriDoc,
    blobs: hdrBlobs,
    options: options({ container: "gltf" }),
  });
  expect(isOk(hdri)).toBe(true);
  if (!hdri.ok) {
    return;
  }
  expect(hdri.value.attribution).toBeDefined();
  const hdriTsx = hdri.value.files.find((file) => file.path === "Scene.tsx");
  expect(hdriTsx).toBeDefined();
  if (hdriTsx === undefined) {
    return;
  }
  const hdriText = await hdriTsx.blob.text();
  expect(hdriText.includes("./scene.gltf")).toBe(true);
  expect(hdriText.includes(".environment.hdr")).toBe(true);
});

test("code-r3f rejects invalid options and abort", async () => {
  const aborted = await exporter.export(
    { document: primitiveDoc(), blobs: new MemoryBlobStore(), options: options() },
    AbortSignal.abort(),
  );
  expect(isErr(aborted)).toBe(true);
  const invalid = await exporter.export({
    document: primitiveDoc(),
    blobs: new MemoryBlobStore(),
    options: { ...options(), outputName: "" },
  });
  expect(isErr(invalid)).toBe(true);
});
