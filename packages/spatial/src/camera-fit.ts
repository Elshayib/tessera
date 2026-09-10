import type { Vec3 } from "@tessera/schema";
import type { FrameBounds } from "./frame-bounds.js";
import { localNegZ, lookAtEuler } from "./look-at.js";

/**
 * Camera entity pose after `camera.fit` (`04` §8.5, Q-0123).
 *
 * @public
 */
export function cameraFitPose(
  framed: FrameBounds,
  current: { readonly position: Vec3; readonly rotation: Vec3 },
  direction: "keep" | "front" | "iso" | "top" = "iso",
): { readonly position: Vec3; readonly rotation: Vec3 } {
  if (direction === "iso") {
    return {
      position: framed.position,
      rotation: lookAtEuler(framed.position, framed.target, [0, 1, 0]),
    };
  }
  const forward = localNegZ(current.rotation);
  const position: Vec3 = [
    framed.target[0] - forward[0] * framed.distance,
    framed.target[1] - forward[1] * framed.distance,
    framed.target[2] - forward[2] * framed.distance,
  ];
  return { position, rotation: current.rotation };
}
