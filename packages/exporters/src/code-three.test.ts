import { CameraSchema, type Document, type Entity, LightSchema } from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createCodeThreeExporter } from "./code-three.js";
import { GltfExportOptionsSchema } from "./options.js";

const exporter = createCodeThreeExporter();

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

async function sceneJs(document: Document, blobs = new MemoryBlobStore()): Promise<string> {
  const result = await exporter.export({ document, blobs, options: options() });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return "";
  }
  const file = result.value.files.find((entry) => entry.path.endsWith("scene.js"));
  expect(file).toBeDefined();
  if (file === undefined) {
    return "";
  }
  return file.blob.text();
}

test("code-three snapshot", async () => {
  const source = await sceneJs(primitiveDoc());
  await expect(source).toMatchFileSnapshot("../fixtures/code-three/scene.js");
});

test("createScene mentioned in output", async () => {
  const source = await sceneJs(primitiveDoc());
  expect(source.includes("createScene({ renderer })")).toBe(true);
  expect(source.includes("{ scene, camera, update }")).toBe(true);
  expect(exporter.id).toBe("code-three");
  expect(exporter.fileExtensions.includes("js")).toBe(true);
  expect(source.startsWith("/**")).toBe(true);
  expect(source.includes("tessera@")).toBe(true);
});

test("code-three is deterministic and covers fog, area lights, and cameras", async () => {
  const built = primitiveDoc();
  const box = Object.values(built.entities).find((entity) => entity.name === "Box");
  if (box === undefined) {
    return;
  }
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
    environment: {
      ...built.environment,
      sky: { kind: "color", color: "#112233" },
      toneMapping: "aces",
      fog: { kind: "linear", color: "#334455", near: 1, far: 20 },
    },
    entities: { ...built.entities, [panel.id]: panel, [cam.id]: cam },
  };
  const blobs = new MemoryBlobStore();
  const first = await exporter.export({ document, blobs, options: options() });
  const second = await exporter.export({ document, blobs, options: options() });
  expect(isOk(first) && isOk(second)).toBe(true);
  if (!first.ok || !second.ok) {
    return;
  }
  const a = first.value.files.find((file) => file.path.endsWith(".js"));
  const b = second.value.files.find((file) => file.path.endsWith(".js"));
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  if (a === undefined || b === undefined) {
    return;
  }
  expect(await a.blob.text()).toBe(await b.blob.text());
  const source = await a.blob.text();
  expect(source.includes("RectAreaLight")).toBe(true);
  expect(source.includes("Fog")).toBe(true);
  expect(source.includes("OrthographicCamera")).toBe(true);
  expect(source.includes("ACESFilmicToneMapping")).toBe(true);
  const exp = await sceneJs({
    ...built,
    environment: {
      ...built.environment,
      fog: { kind: "exponential", color: "#000000", density: 0.02 },
      toneMapping: "agx",
    },
  });
  expect(exp.includes("FogExp2")).toBe(true);
  expect(exp.includes("AgXToneMapping")).toBe(true);
  const none = await sceneJs({
    ...built,
    environment: { ...built.environment, toneMapping: "none" },
  });
  expect(none.includes("NoToneMapping")).toBe(true);
  const missingSky = await sceneJs({
    ...built,
    environment: {
      ...built.environment,
      sky: { kind: "environment", asset: "a_missing000" },
      toneMapping: "neutral",
    },
  });
  expect(missingSky.includes('"kind": "environment"')).toBe(true);
  const perspDoc: Document = {
    ...built,
    settings: {
      ...built.settings,
      mainCamera: Object.values(built.entities).find((entity) => entity.name === "Box")?.id ?? null,
    },
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
  const persp = await sceneJs(perspDoc);
  expect(persp.includes('"type": "perspective"')).toBe(true);
  const omitted = await exporter.export({
    document,
    blobs,
    options: options({ includeCameras: false, includeLights: false }),
  });
  expect(isOk(omitted)).toBe(true);
  if (omitted.ok) {
    const js = omitted.value.files.find((file) => file.path.endsWith(".js"));
    if (js !== undefined) {
      const text = await js.blob.text();
      expect(source.includes('"type": "orthographic"')).toBe(true);
      expect(text.includes('"camera": null')).toBe(true);
      expect(text.includes('"areaLights": []')).toBe(true);
    }
  }
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
  const hdriJs = hdri.value.files.find((file) => file.path.endsWith(".js"));
  expect(hdriJs).toBeDefined();
  if (hdriJs === undefined) {
    return;
  }
  const hdriText = await hdriJs.blob.text();
  expect(hdriText.includes("./scene.gltf")).toBe(true);
  expect(hdriText.includes(".environment.hdr")).toBe(true);
  expect(hdriText.includes('"rotation": 15')).toBe(true);
});

test("code-three rejects invalid options and abort", async () => {
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
