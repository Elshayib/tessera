import type { Document } from "./document.js";

const STAMP = "2026-01-01T00:00:00.000Z";

/**
 * Light intensity defaults (lux / candela / nits). Tune in this file (Q-0002).
 *
 * @public
 */
export const DEFAULT_LIGHT_INTENSITY = {
  directional: 3,
  point: 100,
  spot: 200,
  area: 5,
} as const;

/**
 * Returns a valid empty v0.1.0 document.
 *
 * @public
 */
export function emptyDocument(id = "p_aaaaaaaaaa"): Document {
  return {
    version: "0.1.0",
    meta: {
      id,
      name: "Untitled",
      createdAt: STAMP,
      updatedAt: STAMP,
      generator: "tessera@0.0.0",
    },
    settings: {
      units: "m",
      up: "Y",
      handedness: "right",
      mainCamera: null,
      physics: { gravity: [0, -9.81, 0] },
    },
    entities: {},
    assets: {},
    environment: {
      sky: { kind: "none" },
      exposure: 1,
      toneMapping: "neutral",
      fog: { kind: "none" },
      ambient: { color: "#ffffff", intensity: 0.2 },
    },
    behaviors: {},
  };
}
