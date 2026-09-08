import { expect, test } from "vitest";
import committed from "../json-schema/sidecar.v1.json" with { type: "json" };
import { DOCUMENT_VERSION } from "./document.js";
import {
  emitSidecarJsonSchema,
  emitSidecarJsonSchemaText,
  SIDECAR_FORMAT,
  SIDECAR_VERSION,
  SidecarSchema,
} from "./sidecar.js";

const example = {
  format: SIDECAR_FORMAT,
  version: SIDECAR_VERSION,
  documentVersion: DOCUMENT_VERSION,
  generator: "tessera@0.0.0",
  settings: {
    units: "m" as const,
    up: "Y" as const,
    handedness: "right" as const,
    mainCamera: null,
  },
  environment: {
    sky: { kind: "none" as const },
    exposure: 1,
    toneMapping: "neutral" as const,
    fog: { kind: "none" as const },
    ambient: { color: "#ffffff", intensity: 0.2 },
  },
  entities: [
    {
      id: "e_7f3a9k2m1p",
      name: "oak_01",
      path: "/forest/oak_01",
      nodeIndex: 12,
      enabled: true,
      visible: true,
      tags: ["vegetation", "static"],
      collider: {
        shape: "box" as const,
        size: [2.1, 6.3, 2] as const,
        offset: [0, 3.15, 0] as const,
        isTrigger: false,
      },
      rigidBody: {
        type: "static" as const,
        mass: 1,
        friction: 0.5,
        restitution: 0,
      },
      metadata: { lootTier: 2 },
      behaviors: [],
      light: null,
      camera: null,
    },
  ],
  assets: [
    {
      id: "a_oak0000001",
      kind: "geometry" as const,
      name: "oak",
      license: "CC0-1.0",
      provenance: {
        source: "polyhaven",
        sourceId: "oak_tree_01",
        importedAt: "2026-09-06T18:00:00.000Z",
      },
    },
  ],
};

test("sidecar schema accepts 09 §4 shape and omits exportedAt", () => {
  const parsed = SidecarSchema.parse(example);
  expect(parsed.format).toBe("tessera-sidecar");
  expect(parsed.version).toBe(1);
  expect(parsed.exportedAt).toBeUndefined();
  expect(
    SidecarSchema.parse({ ...example, exportedAt: "2026-09-06T18:00:00.000Z" }).exportedAt,
  ).toBe("2026-09-06T18:00:00.000Z");
  expect(SidecarSchema.safeParse({ ...example, format: "other" }).success).toBe(false);
});

test("emitSidecarJsonSchema is stable", () => {
  const first = emitSidecarJsonSchema();
  expect(first).toEqual(emitSidecarJsonSchema());
  expect(first).toEqual(committed);
  expect(emitSidecarJsonSchemaText()).toBe(`${JSON.stringify(first, null, 2)}\n`);
});
