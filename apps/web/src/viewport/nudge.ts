import type { Document, Transform } from "@tessera/schema";
import type { TransformSetIntent } from "./apply-intent.js";

/**
 * Translate snap increment (`05` §7).
 *
 * @public
 */
export const TRANSLATE_SNAP_M = 0.1;

/**
 * Shift multiplier for keyboard nudge (Q-0031).
 *
 * @public
 */
export const SHIFT_NUDGE_MULTIPLIER = 10;

function deltaForKey(key: string): readonly [number, number, number] | undefined {
  if (key === "ArrowRight") {
    return [1, 0, 0];
  }
  if (key === "ArrowLeft") {
    return [-1, 0, 0];
  }
  if (key === "ArrowUp") {
    return [0, 0, -1];
  }
  if (key === "ArrowDown") {
    return [0, 0, 1];
  }
  return undefined;
}

/**
 * Builds a `transform.set` intent that moves selected entities by the snap step
 * in the world XZ plane (Q-0067).
 *
 * @public
 */
export function nudgeIntent(
  snapshot: Document,
  ids: readonly string[],
  key: string,
  shift: boolean,
): TransformSetIntent | undefined {
  const step = deltaForKey(key);
  if (step === undefined || ids.length === 0) {
    return undefined;
  }
  const scale = shift ? TRANSLATE_SNAP_M * SHIFT_NUDGE_MULTIPLIER : TRANSLATE_SNAP_M;
  const targets: { id: string; transform: Transform }[] = [];
  let name = "Entity";
  for (const id of ids) {
    const entity = snapshot.entities[id];
    if (entity === undefined) {
      continue;
    }
    name = entity.name;
    const transform = entity.components.transform;
    targets.push({
      id,
      transform: {
        position: [
          transform.position[0] + step[0] * scale,
          transform.position[1] + step[1] * scale,
          transform.position[2] + step[2] * scale,
        ],
        rotation: [transform.rotation[0], transform.rotation[1], transform.rotation[2]],
        scale: [transform.scale[0], transform.scale[1], transform.scale[2]],
      },
    });
  }
  if (targets.length === 0) {
    return undefined;
  }
  return { kind: "transform.set", label: `Move ${name}`, targets };
}
