import type { Aabb } from "@tessera/schema";
import { frameBounds } from "@tessera/spatial";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { ok, systemClock } from "@tessera/std";
import CameraControls from "camera-controls";
import type { PerspectiveCamera } from "three";
import {
  Box3,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import type { CameraPose } from "./types.js";

const FRAME_MS = 300;

let controlsInstalled = false;

/**
 * Options for {@link createViewportCamera}.
 *
 * @public
 */
export interface CreateViewportCameraOptions {
  readonly camera: PerspectiveCamera;
  readonly domElement: HTMLElement;
  readonly clock?: Clock;
  readonly reducedMotion?: () => boolean;
}

/**
 * Orbit camera that is UI state only (`INV-ARCH-04`). Never writes the document.
 *
 * @public
 */
export interface ViewportCamera {
  getPose(): CameraPose;
  setPose(pose: CameraPose): void;
  frame(
    targets: readonly Aabb[],
    options?: { padding?: number; animate?: boolean },
  ): Result<void, TesseraError>;
  update(): void;
  dispose(): void;
}

/**
 * Creates a `camera-controls` orbit camera (`05` §8).
 *
 * @example
 * ```ts
 * const viewport = createViewportCamera({ camera, domElement });
 * viewport.setPose({ position: [5, 5, 5], target: [0, 0, 0] });
 * ```
 *
 * @public
 */
export function createViewportCamera(options: CreateViewportCameraOptions): ViewportCamera {
  return new ViewportCameraImpl(options);
}

class ViewportCameraImpl implements ViewportCamera {
  readonly #controls: CameraControls;
  readonly #clock: Clock;
  readonly #reducedMotion: () => boolean;
  #animation:
    | { readonly from: CameraPose; readonly to: CameraPose; readonly startMs: number }
    | undefined;
  #lastNow: number;

  constructor(options: CreateViewportCameraOptions) {
    installControls();
    this.#controls = new CameraControls(options.camera, options.domElement);
    this.#controls.smoothTime = FRAME_MS / 1000;
    this.#clock = options.clock ?? systemClock;
    this.#reducedMotion = options.reducedMotion ?? prefersReducedMotion;
    this.#lastNow = this.#clock.now();
  }

  getPose(): CameraPose {
    const position = new Vector3();
    const target = new Vector3();
    this.#controls.getPosition(position);
    this.#controls.getTarget(target);
    return {
      position: [position.x, position.y, position.z],
      target: [target.x, target.y, target.z],
    };
  }

  setPose(pose: CameraPose): void {
    this.#animation = undefined;
    void this.#controls.setLookAt(
      pose.position[0],
      pose.position[1],
      pose.position[2],
      pose.target[0],
      pose.target[1],
      pose.target[2],
      false,
    );
  }

  frame(
    targets: readonly Aabb[],
    options?: { padding?: number; animate?: boolean },
  ): Result<void, TesseraError> {
    const framed = frameBounds(targets, options?.padding);
    if (!framed.ok) {
      return framed;
    }
    const to: CameraPose = { position: framed.value.position, target: framed.value.target };
    const instant = options?.animate === false || this.#reducedMotion();
    if (instant) {
      this.setPose(to);
      return ok(undefined);
    }
    this.#animation = { from: this.getPose(), to, startMs: this.#clock.now() };
    return ok(undefined);
  }

  update(): void {
    const now = this.#clock.now();
    const delta = Math.max(0, now - this.#lastNow) / 1000;
    this.#lastNow = now;
    const animation = this.#animation;
    if (animation !== undefined) {
      const t = Math.min(1, (now - animation.startMs) / FRAME_MS);
      const pose = lerpPose(animation.from, animation.to, t);
      void this.#controls.setLookAt(
        pose.position[0],
        pose.position[1],
        pose.position[2],
        pose.target[0],
        pose.target[1],
        pose.target[2],
        false,
      );
      if (t >= 1) {
        this.#animation = undefined;
      }
    }
    this.#controls.update(delta);
  }

  dispose(): void {
    this.#controls.dispose();
  }
}

function installControls(): void {
  if (controlsInstalled) {
    return;
  }
  CameraControls.install({
    THREE: {
      Vector2,
      Vector3,
      Vector4,
      Quaternion,
      Matrix4,
      Spherical,
      Box3,
      Sphere,
      Raycaster,
    },
  });
  controlsInstalled = true;
}

function prefersReducedMotion(): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  return {
    position: lerpVec(from.position, to.position, t),
    target: lerpVec(from.target, to.target, t),
  };
}

function lerpVec(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}
