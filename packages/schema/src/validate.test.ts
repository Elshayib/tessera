import { expect, test } from "vitest";
import { emptyDocument } from "./defaults.js";
import type { Document, Entity } from "./document.js";
import { validateDocument } from "./validate.js";

function entity(id: string, name: string, parent: string | null = null): Entity {
  return {
    id,
    name,
    parent,
    order: "a0",
    enabled: true,
    components: {
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    },
  };
}

function withEntities(doc: Document, entities: Record<string, Entity>): Document {
  return { ...doc, entities };
}

test("INV-DOC-01 unique ids across maps", () => {
  const doc = emptyDocument();
  const first = entity("e_bbbbbbbbbb", "First");
  const second = entity("e_bbbbbbbbbb", "Second");
  const report = validateDocument(
    withEntities(doc, {
      e_aaaaaaaaaa: { ...first, id: "e_bbbbbbbbbb" },
      e_bbbbbbbbbb: second,
    }),
  );
  expect(report.issues.some((item) => item.invariant === "INV-DOC-01")).toBe(true);
});

test("INV-DOC-02 parent exists", () => {
  const doc = emptyDocument();
  const child = entity("e_child00001", "Child", "e_missing001");
  const report = validateDocument(withEntities(doc, { e_child00001: child }));
  expect(report.issues.some((item) => item.invariant === "INV-DOC-02")).toBe(true);
});

test("INV-DOC-03 no parent cycles", () => {
  const doc = emptyDocument();
  const a = entity("e_cycle0000a", "A", "e_cycle0000b");
  const b = entity("e_cycle0000b", "B", "e_cycle0000a");
  const report = validateDocument(withEntities(doc, { e_cycle0000a: a, e_cycle0000b: b }));
  expect(report.issues.some((item) => item.invariant === "INV-DOC-03")).toBe(true);
});

test("INV-DOC-04 transform required", () => {
  const doc = emptyDocument();
  const raw = structuredClone(doc) as Record<string, unknown>;
  raw.entities = {
    e_notrans000: {
      id: "e_notrans000",
      name: "Bare",
      parent: null,
      order: "a0",
      enabled: true,
      components: {},
    },
  };
  const report = validateDocument(raw);
  expect(report.issues.some((item) => item.invariant === "INV-DOC-04")).toBe(true);
});

test("INV-DOC-05 rigidBody requires collider", () => {
  const doc = emptyDocument();
  const body = entity("e_rigid00001", "Body");
  const report = validateDocument(
    withEntities(doc, {
      e_rigid00001: {
        ...body,
        components: {
          ...body.components,
          rigidBody: { type: "dynamic", mass: 1, friction: 0.5, restitution: 0 },
        },
      },
    }),
  );
  expect(report.issues.some((item) => item.invariant === "INV-DOC-05")).toBe(true);
});

test("INV-DOC-06 asset refs resolve and kind-match", () => {
  const doc = emptyDocument();
  const mesh = entity("e_mesh000001", "Mesh");
  const report = validateDocument(
    withEntities(doc, {
      e_mesh000001: {
        ...mesh,
        components: {
          ...mesh.components,
          meshRenderer: {
            geometry: "a_missing001",
            materials: [],
            castShadow: true,
            receiveShadow: true,
            visible: true,
          },
        },
      },
    }),
  );
  expect(report.issues.some((item) => item.invariant === "INV-DOC-06")).toBe(true);
});

test("INV-DOC-07 sibling and asset name uniqueness", () => {
  const doc = emptyDocument();
  const report = validateDocument(
    withEntities(doc, {
      e_name00000a: entity("e_name00000a", "Lamp"),
      e_name00000b: entity("e_name00000b", "lamp"),
    }),
  );
  expect(report.issues.some((item) => item.invariant === "INV-DOC-07")).toBe(true);

  const stamp = "2026-01-01T00:00:00.000Z";
  const geom = {
    kind: "geometry" as const,
    license: "CC0-1.0",
    provenance: { source: "primitive", importedAt: stamp },
    createdAt: stamp,
    source: {
      kind: "primitive" as const,
      primitive: { type: "box" as const, size: [1, 1, 1] as const },
    },
    bounds: { min: [-0.5, -0.5, -0.5] as const, max: [0.5, 0.5, 0.5] as const },
    stats: { triangles: 12, vertices: 8, primitiveGroups: 1 },
  };
  const assetsReport = validateDocument({
    ...doc,
    assets: {
      a_dup000000a: { ...geom, id: "a_dup000000a", name: "Cube" },
      a_dup000000b: { ...geom, id: "a_dup000000b", name: "cube" },
    },
  });
  expect(assetsReport.issues.some((item) => item.invariant === "INV-DOC-07")).toBe(true);
});

test("empty document validates and extra structural paths report", () => {
  expect(validateDocument(emptyDocument()).ok).toBe(true);
  expect(validateDocument("nope").ok).toBe(false);

  const missingCamera = emptyDocument();
  const reportCamera = validateDocument({
    ...missingCamera,
    settings: { ...missingCamera.settings, mainCamera: "e_camera0001" },
  });
  expect(reportCamera.ok).toBe(false);

  const sky = emptyDocument();
  const reportSky = validateDocument({
    ...sky,
    environment: {
      ...sky.environment,
      sky: { kind: "environment", asset: "a_env0000001" },
    },
  });
  expect(reportSky.issues.some((item) => item.invariant === "INV-DOC-06")).toBe(true);

  const body = entity("e_convex0001", "Convex");
  const convex = validateDocument(
    withEntities(emptyDocument(), {
      e_convex0001: {
        ...body,
        components: {
          ...body.components,
          collider: {
            shape: "convex",
            fit: "auto",
            size: [1, 1, 1],
            radius: 0.5,
            height: 1,
            offset: [0, 0, 0],
            isTrigger: false,
          },
        },
      },
    }),
  );
  expect(convex.ok).toBe(false);

  const chain: Record<string, Entity> = {};
  let parent: string | null = null;
  for (let i = 0; i < 66; i += 1) {
    const id = `e_d${i.toString().padStart(9, "0")}`;
    chain[id] = entity(id, `N${String(i)}`, parent);
    parent = id;
  }
  const deep = validateDocument(withEntities(emptyDocument(), chain));
  expect(deep.ok).toBe(false);
});

test("validate walks asset, texture, behavior, and procedural refs", () => {
  const stamp = "2026-01-01T00:00:00.000Z";
  const doc = emptyDocument();
  const report = validateDocument({
    ...doc,
    assets: {
      a_geo0000001: {
        id: "a_geo0000002",
        kind: "geometry",
        name: "Proc",
        license: "CC0-1.0",
        provenance: { source: "derived", importedAt: stamp },
        createdAt: stamp,
        source: { kind: "procedural", script: "a_script0001", params: {} },
        bounds: { min: [0, 0, 0], max: [1, 1, 1] },
        stats: { triangles: 0, vertices: 0, primitiveGroups: 0 },
      },
      a_mattex0001: {
        id: "a_mattex0001",
        kind: "material",
        name: "Textured",
        license: "CC0-1.0",
        provenance: { source: "upload", importedAt: stamp },
        createdAt: stamp,
        model: "pbr",
        baseColor: "#cccccc",
        baseColorTexture: { texture: "a_tex0000001", texCoord: 0 },
        metallic: 0,
        roughness: 0.6,
        emissive: "#000000",
        emissiveStrength: 1,
        opacity: 1,
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        doubleSided: false,
      },
    },
    behaviors: {
      b_anim000001: {
        id: "b_anim000001",
        name: "Spin",
        target: "e_missing001",
        script: "a_script0001",
        params: {},
        enabled: true,
      },
    },
  });
  expect(report.ok).toBe(false);
  expect(report.issues.length).toBeGreaterThan(0);
});
