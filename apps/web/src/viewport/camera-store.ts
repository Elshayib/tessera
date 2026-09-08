/**
 * localStorage key for the last viewport camera pose (`05` §8). UI state only.
 *
 * @public
 */
export const VIEWPORT_CAMERA_KEY = "tessera.ui.viewportCamera";

/**
 * Look-at pose stored as UI state (`INV-ARCH-04`).
 *
 * @public
 */
export interface StoredCameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

function readField(record: object, name: string): unknown {
  for (const [key, value] of Object.entries(record)) {
    if (key === name) {
      return value;
    }
  }
  return undefined;
}

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isTriple(value: unknown): value is [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) {
    return false;
  }
  return (
    typeof value[0] === "number" && typeof value[1] === "number" && typeof value[2] === "number"
  );
}

/**
 * Reads the persisted viewport camera. Missing or invalid data is ignored.
 *
 * @public
 */
export function loadViewportCamera(): StoredCameraPose | undefined {
  const raw = storage()?.getItem(VIEWPORT_CAMERA_KEY);
  if (raw === null || raw === undefined) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }
    const position = readField(parsed, "position");
    const target = readField(parsed, "target");
    if (!isTriple(position) || !isTriple(target)) {
      return undefined;
    }
    return { position, target };
  } catch {
    return undefined;
  }
}

/**
 * Writes the viewport camera to localStorage. Never writes the document.
 *
 * @public
 */
export function saveViewportCamera(pose: StoredCameraPose): void {
  storage()?.setItem(
    VIEWPORT_CAMERA_KEY,
    JSON.stringify({ position: pose.position, target: pose.target }),
  );
}
