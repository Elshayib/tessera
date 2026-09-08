import type { Clock, Result, TesseraError } from "@tessera/std";
import { abortError, err, ok, systemClock, tesseraError } from "@tessera/std";
import type { Camera, Object3D, Scene } from "three";
import { Color as ThreeColor } from "three";
import type { CameraPose, Screenshot } from "./types.js";

const MAX_WIDTH = 2048;
const NEUTRAL = "#808080";

/**
 * Offscreen capture backend so tests run without a GPU.
 *
 * @public
 */
export type ScreenshotRender = (scene: Scene, camera: Camera) => Blob | Promise<Blob>;

/**
 * Options for {@link captureScreenshot} (`05` §10).
 *
 * @public
 */
export interface CaptureScreenshotOptions {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly pose: CameraPose;
  readonly width: number;
  readonly height: number;
  readonly includeHelpers?: boolean;
  readonly format?: "png" | "jpeg";
  readonly background?: "scene" | "neutral";
  readonly render: ScreenshotRender;
  readonly clock?: Clock;
  readonly signal?: AbortSignal;
}

/**
 * Renders a screenshot into a caller-provided target. Helpers/gizmos (layers 1–2)
 * are hidden unless `includeHelpers` (`INV-RND-07`). The live scene is restored after capture.
 *
 * @example
 * ```ts
 * const shot = await captureScreenshot({ scene, camera, pose, width: 64, height: 64, render });
 * ```
 *
 * @public
 */
export async function captureScreenshot(
  options: CaptureScreenshotOptions,
): Promise<Result<Screenshot, TesseraError>> {
  if (options.signal?.aborted === true) {
    return err(abortError());
  }
  if (
    !Number.isInteger(options.width) ||
    !Number.isInteger(options.height) ||
    options.width < 1 ||
    options.height < 1 ||
    options.width > MAX_WIDTH
  ) {
    return err(
      tesseraError("INVALID_INPUT", "screenshot size is invalid", { width: options.width }),
    );
  }
  const hidden = options.includeHelpers === true ? [] : hideHelpers(options.scene);
  const previousBackground = options.scene.background;
  if (options.background === "neutral") {
    options.scene.background = new ThreeColor(NEUTRAL);
  }
  try {
    const blob = await options.render(options.scene, options.camera);
    const clock = options.clock ?? systemClock;
    const type = options.format === "jpeg" ? "image/jpeg" : "image/png";
    const typed = blob.type === type ? blob : new Blob([blob], { type });
    return ok({
      blob: typed,
      width: options.width,
      height: options.height,
      camera: options.pose,
      renderedAt: clock.nowIso(),
    });
  } finally {
    restoreHelpers(hidden);
    options.scene.background = previousBackground;
  }
}

interface Hidden {
  readonly object: Object3D;
  readonly visible: boolean;
}

function hideHelpers(root: Object3D): Hidden[] {
  const hidden: Hidden[] = [];
  root.traverse((object) => {
    if (isHelperLayer(object)) {
      hidden.push({ object, visible: object.visible });
      object.visible = false;
    }
  });
  return hidden;
}

function restoreHelpers(hidden: readonly Hidden[]): void {
  for (const entry of hidden) {
    entry.object.visible = entry.visible;
  }
}

function isHelperLayer(object: Object3D): boolean {
  return object.layers.isEnabled(1) || object.layers.isEnabled(2);
}
