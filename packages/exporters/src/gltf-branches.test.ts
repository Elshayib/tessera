import {
  CameraSchema,
  type Document,
  type Entity,
  LightSchema,
  SidecarSchema,
} from "@tessera/schema";
import { isErr, isOk } from "@tessera/std";
import { MemoryBlobStore } from "@tessera/storage";
import { docBuilder } from "@tessera/testing";
import { expect, test } from "vitest";
import { createGltfExporter } from "./gltf.js";
import { GltfExportOptionsSchema } from "./options.js";

const exporter = createGltfExporter();

function options(overrides: Record<string, unknown> = {}) {
  return GltfExportOptionsSchema.parse({ outputName: "scene", deterministic: true, ...overrides });
}

function baseDoc(): Document {
  return docBuilder()
    .geometry("box")
    .material("mat", { baseColor: "#8b5a2b", model: "unlit" })
    .entity("Parent", {})
    .entity("Box", {
      parent: "Parent",
      mesh: "box",
      material: "mat",
    })
    .entity("Hidden", { mesh: "box", enabled: false })
    .build();
}

test("exports lights, cameras, gltf container, and option flags", async () => {
  const built = baseDoc();
  const sun: Entity = {
    id: "e_sun0000000",
    name: "Sun",
    parent: null,
    order: "z0",
    enabled: true,
    components: {
      transform: { position: [0, 4, 0], rotation: [-45, 0, 0], scale: [1, 1, 1] },
      light: LightSchema.parse({ type: "directional", intensity: 3 }),
    },
  };
  const lamp: Entity = {
    id: "e_lamp000000",
    name: "Lamp",
    parent: null,
    order: "z1",
    enabled: true,
    components: {
      transform: { position: [1, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      light: LightSchema.parse({ type: "point", intensity: 80, range: 10 }),
    },
  };
  const spot: Entity = {
    id: "e_spot000000",
    name: "Spot",
    parent: null,
    order: "z2",
    enabled: true,
    components: {
      transform: { position: [0, 3, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
      light: LightSchema.parse({ type: "spot", angle: 30, penumbra: 0.2, range: 8 }),
    },
  };
  const area: Entity = {
    id: "e_area000000",
    name: "Area",
    parent: null,
    order: "z3",
    enabled: true,
    components: {
      transform: { position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      light: LightSchema.parse({ type: "area", size: [1, 1] }),
    },
  };
  const cam: Entity = {
    id: "e_cam0000000",
    name: "Cam",
    parent: null,
    order: "z4",
    enabled: true,
    components: {
      transform: { position: [0, 1, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
      camera: CameraSchema.parse({ type: "perspective", fov: 50 }),
    },
  };
  const ortho: Entity = {
    id: "e_ortho00000",
    name: "Ortho",
    parent: null,
    order: "z5",
    enabled: true,
    components: {
      transform: { position: [0, 1, 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
      camera: CameraSchema.parse({ type: "orthographic", orthoSize: 4 }),
    },
  };
  const materials = Object.values(built.assets).map((asset) => {
    if (asset.kind !== "material") {
      return asset;
    }
    return {
      ...asset,
      license: "unknown",
      transmission: 0.2,
      ior: 1.45,
      thickness: 0.1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.1,
      emissiveStrength: 2,
      alphaMode: "mask" as const,
      doubleSided: true,
    };
  });
  const assets: Document["assets"] = {};
  for (const asset of materials) {
    assets[asset.id] = asset;
  }
  const box = Object.values(built.entities).find((entity) => entity.name === "Box");
  const entities = {
    ...built.entities,
    [sun.id]: sun,
    [lamp.id]: lamp,
    [spot.id]: spot,
    [area.id]: area,
    [cam.id]: cam,
    [ortho.id]: ortho,
  };
  if (box !== undefined && box.components.meshRenderer !== undefined) {
    entities[box.id] = {
      ...box,
      components: {
        ...box.components,
        meshRenderer: { ...box.components.meshRenderer, visible: false },
        rigidBody: { type: "static", mass: 1, friction: 0.5, restitution: 0 },
        metadata: { loot: 1 },
      },
    };
  }
  const document: Document = {
    ...built,
    assets,
    settings: { ...built.settings, mainCamera: cam.id },
    environment: {
      ...built.environment,
      sky: { kind: "color", color: "#112233" },
    },
    entities,
  };
  const result = await exporter.export({
    document,
    blobs: new MemoryBlobStore(),
    options: options({
      container: "gltf",
      includeDisabled: true,
      textures: "png",
      bakeUnitScale: 2,
    }),
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.files.some((file) => file.path.endsWith(".gltf"))).toBe(true);
  expect(result.value.warnings.some((warning) => /unknown/.test(warning))).toBe(true);
  expect(result.value.warnings.some((warning) => /png/.test(warning))).toBe(true);
  expect(result.value.warnings.some((warning) => /area light/.test(warning))).toBe(true);
});

test("selection, omitted sidecar, and disabled lights/cameras", async () => {
  const document = baseDoc();
  const box = Object.values(document.entities).find((entity) => entity.name === "Box");
  expect(box).toBeDefined();
  if (box === undefined) {
    return;
  }
  const selected = await exporter.export({
    document,
    blobs: new MemoryBlobStore(),
    options: options({
      selection: [box.id],
      sidecar: false,
      includeLights: false,
      includeCameras: false,
      includeColliders: false,
    }),
  });
  expect(isOk(selected)).toBe(true);
  if (!selected.ok) {
    return;
  }
  expect(selected.value.files.some((file) => file.path.endsWith(".tessera.json"))).toBe(false);
});

test("invalid options and missing blob geometry", async () => {
  const invalid = await exporter.export({
    document: baseDoc(),
    blobs: new MemoryBlobStore(),
    options: { ...options(), outputName: "" },
  });
  expect(isErr(invalid)).toBe(true);
  const built = baseDoc();
  const geo = Object.values(built.assets).find((asset) => asset.kind === "geometry");
  if (geo === undefined || geo.kind !== "geometry") {
    return;
  }
  const hashed = {
    ...built,
    assets: {
      ...built.assets,
      [geo.id]: {
        ...geo,
        source: {
          kind: "blob" as const,
          blob: {
            hash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            size: 1,
            mime: "model/gltf-binary",
          },
          meshIndex: 0,
        },
      },
    },
  };
  const missing = await exporter.export({
    document: hashed,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isErr(missing) && missing.error.code === "NOT_FOUND").toBe(true);
});

test("procedural geometry is skipped with a warning", async () => {
  const built = baseDoc();
  const geo = Object.values(built.assets).find((asset) => asset.kind === "geometry");
  if (geo === undefined || geo.kind !== "geometry") {
    return;
  }
  const document = {
    ...built,
    assets: {
      ...built.assets,
      [geo.id]: {
        ...geo,
        source: { kind: "procedural" as const, script: "a_script0000", params: {} },
      },
    },
  };
  const result = await exporter.export({
    document,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isOk(result)).toBe(true);
  if (result.ok) {
    expect(result.value.warnings.some((warning) => /procedural/.test(warning))).toBe(true);
  }
});

test("HDRI environment file is emitted", async () => {
  const built = baseDoc();
  const blobs = new MemoryBlobStore();
  const written = await blobs.write(new Uint8Array([1, 2, 3, 4]), "image/vnd.radiance", "sky.hdr");
  expect(isOk(written)).toBe(true);
  if (!written.ok) {
    return;
  }
  const envId = "a_env0000000";
  const document: Document = {
    ...built,
    assets: {
      ...built.assets,
      [envId]: {
        id: envId,
        name: "Sky",
        license: "CC0-1.0",
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
  const result = await exporter.export({ document, blobs, options: options() });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.value.files.some((file) => file.path.endsWith(".environment.hdr"))).toBe(true);
});

test("meshopt is UNSUPPORTED and environment sky without asset warns", async () => {
  const meshopt = await exporter.export({
    document: baseDoc(),
    blobs: new MemoryBlobStore(),
    options: options({ compression: "meshopt" }),
  });
  expect(isErr(meshopt) && meshopt.error.code === "UNSUPPORTED").toBe(true);
  const built = baseDoc();
  const missingEnv: Document = {
    ...built,
    environment: { ...built.environment, sky: { kind: "environment", asset: "a_missing000" } },
  };
  const warned = await exporter.export({
    document: missingEnv,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isOk(warned)).toBe(true);
  if (warned.ok) {
    expect(warned.value.warnings.some((warning) => /environment/.test(warning))).toBe(true);
  }
  const colorEnv: Document = {
    ...built,
    assets: {
      ...built.assets,
      a_env0000000: {
        id: "a_env0000000",
        name: "Solid",
        license: "CC0-1.0",
        provenance: { source: "tessera", importedAt: built.meta.createdAt },
        createdAt: built.meta.createdAt,
        kind: "environment",
        source: { kind: "color", color: "#abcdef" },
        rotation: 0,
        intensity: 1,
      },
    },
    environment: { ...built.environment, sky: { kind: "environment", asset: "a_env0000000" } },
  };
  const color = await exporter.export({
    document: colorEnv,
    blobs: new MemoryBlobStore(),
    options: options(),
  });
  expect(isOk(color)).toBe(true);
});

test("texture slots, blend, behaviors, and non-deterministic sidecar", async () => {
  const built = baseDoc();
  const blobs = new MemoryBlobStore();
  const png = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0,
    0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 0, 2, 0,
    1, 226, 33, 188, 51, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
  const written = await blobs.write(png, "image/png", "red.png");
  expect(isOk(written)).toBe(true);
  if (!written.ok) {
    return;
  }
  const texId = "a_tex0000000";
  const mat = Object.values(built.assets).find((asset) => asset.kind === "material");
  const box = Object.values(built.entities).find((entity) => entity.name === "Box");
  if (mat === undefined || mat.kind !== "material" || box === undefined) {
    return;
  }
  const slot = {
    texture: texId,
    texCoord: 0 as const,
    scale: [1, 1] as const,
    offset: [0, 0] as const,
    rotation: 0,
  };
  const document: Document = {
    ...built,
    assets: {
      ...built.assets,
      [texId]: {
        id: texId,
        name: "Red",
        license: "proprietary",
        provenance: {
          source: "upload",
          sourceId: "x",
          sourceUrl: "https://example.com/t",
          author: "Pat",
          importedAt: built.meta.createdAt,
        },
        createdAt: built.meta.createdAt,
        kind: "texture",
        blob: written.value,
        colorSpace: "srgb",
        wrapS: "clamp",
        wrapT: "mirror",
        size: [2, 2],
        hasAlpha: false,
      },
      [mat.id]: {
        ...mat,
        alphaMode: "blend",
        baseColorTexture: slot,
        metallicRoughnessTexture: slot,
        normalTexture: slot,
        occlusionTexture: slot,
        emissiveTexture: slot,
      },
    },
    behaviors: {
      b_spin000000: {
        id: "b_spin000000",
        name: "spin",
        target: box.id,
        script: "a_script0000",
        params: { speed: 1 },
        enabled: true,
      },
    },
    environment: {
      ...built.environment,
      fog: { kind: "linear", color: "#000000", near: 1, far: 10 },
    },
  };
  const result = await exporter.export({
    document,
    blobs,
    options: options({ deterministic: false }),
  });
  expect(isOk(result)).toBe(true);
  if (!result.ok) {
    return;
  }
  const sidecarFile = result.value.files.find((file) => file.path.endsWith(".tessera.json"));
  expect(sidecarFile).toBeDefined();
  if (sidecarFile === undefined) {
    return;
  }
  const parsed: unknown = JSON.parse(await sidecarFile.blob.text());
  const sidecar = SidecarSchema.parse(parsed);
  expect(typeof sidecar.exportedAt).toBe("string");
});
