import type { Vec3 } from "@tessera/schema";
import { composeTrs, transformPoint } from "./math.js";

const RAD = 180 / Math.PI;

function length3(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

function normalize(x: number, y: number, z: number): Vec3 {
  const len = length3(x, y, z);
  if (len < 1e-8) {
    return [0, 0, 1];
  }
  return [x / len, y / len, z / len];
}

/**
 * Euler degrees XYZ so local −Z faces `to` from `from` (`04` §8.5).
 *
 * @example
 * ```ts
 * lookAtEuler([0, 0, 0], [0, 0, -1], [0, 1, 0]);
 * ```
 *
 * @public
 */
export function lookAtEuler(from: Vec3, to: Vec3, up: Vec3 = [0, 1, 0]): Vec3 {
  const dir = normalize(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const localZ = normalize(-dir[0], -dir[1], -dir[2]);
  let localX = normalize(
    up[1] * localZ[2] - up[2] * localZ[1],
    up[2] * localZ[0] - up[0] * localZ[2],
    up[0] * localZ[1] - up[1] * localZ[0],
  );
  if (length3(localX[0], localX[1], localX[2]) < 1e-8) {
    localX = normalize(1, 0, 0);
  }
  const localY = normalize(
    localZ[1] * localX[2] - localZ[2] * localX[1],
    localZ[2] * localX[0] - localZ[0] * localX[2],
    localZ[0] * localX[1] - localZ[1] * localX[0],
  );
  const r20 = localX[2];
  const r00 = localX[0];
  const r10 = localX[1];
  const r21 = localY[2];
  const r22 = localZ[2];
  const r12 = localZ[1];
  const r11 = localY[1];
  const y = Math.asin(clamp(-r20, -1, 1));
  const cosY = Math.cos(y);
  let x: number;
  let z: number;
  if (Math.abs(cosY) > 1e-8) {
    x = Math.atan2(r21, r22);
    z = Math.atan2(r10, r00);
  } else {
    x = Math.atan2(-r12, r11);
    z = 0;
  }
  return [x * RAD, y * RAD, z * RAD];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * World-space local −Z of a TRS rotation.
 *
 * @public
 */
export function localNegZ(rotation: Vec3): Vec3 {
  const world = composeTrs([0, 0, 0], rotation, [1, 1, 1]);
  const tip = transformPoint(world, [0, 0, -1]);
  return [tip[0], tip[1], tip[2]];
}
