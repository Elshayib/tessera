import { invariant } from "@tessera/std";

type Vec3 = readonly [number, number, number];

/** Column-major 4×4 matrix. */
export type Mat4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * Identity matrix.
 *
 * @internal
 */
export function identityMat4(): Mat4 {
  return IDENTITY;
}

/**
 * Local TRS matrix: Euler XYZ degrees, column-major, right-handed.
 *
 * @internal
 */
export function composeTrs(
  position: readonly [number, number, number],
  rotationDeg: readonly [number, number, number],
  scale: readonly [number, number, number],
): Mat4 {
  const x = rotationDeg[0] * DEG;
  const y = rotationDeg[1] * DEG;
  const z = rotationDeg[2] * DEG;
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);
  const sxn = scale[0];
  const syn = scale[1];
  const szn = scale[2];
  const r00 = cy * cz;
  const r01 = sx * sy * cz - cx * sz;
  const r02 = cx * sy * cz + sx * sz;
  const r10 = cy * sz;
  const r11 = sx * sy * sz + cx * cz;
  const r12 = cx * sy * sz - sx * cz;
  const r20 = -sy;
  const r21 = sx * cy;
  const r22 = cx * cy;
  return [
    r00 * sxn,
    r10 * sxn,
    r20 * sxn,
    0,
    r01 * syn,
    r11 * syn,
    r21 * syn,
    0,
    r02 * szn,
    r12 * szn,
    r22 * szn,
    0,
    position[0],
    position[1],
    position[2],
    1,
  ];
}

function mAt(m: Mat4, col: number, row: number): number {
  const value = m[col * 4 + row];
  invariant(value !== undefined, "mat4 index in range");
  return value;
}

/**
 * `a * b` for column vectors (b applied first).
 *
 * @internal
 */
export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const n = (col: number, row: number): number =>
    mAt(a, 0, row) * mAt(b, col, 0) +
    mAt(a, 1, row) * mAt(b, col, 1) +
    mAt(a, 2, row) * mAt(b, col, 2) +
    mAt(a, 3, row) * mAt(b, col, 3);
  return [
    n(0, 0),
    n(0, 1),
    n(0, 2),
    n(0, 3),
    n(1, 0),
    n(1, 1),
    n(1, 2),
    n(1, 3),
    n(2, 0),
    n(2, 1),
    n(2, 2),
    n(2, 3),
    n(3, 0),
    n(3, 1),
    n(3, 2),
    n(3, 3),
  ];
}

function det3(
  a00: number,
  a01: number,
  a02: number,
  a10: number,
  a11: number,
  a12: number,
  a20: number,
  a21: number,
  a22: number,
): number {
  return (
    a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20)
  );
}

/**
 * Inverse of a 4×4 matrix, or `undefined` when singular.
 *
 * @internal
 */
export function invertMat4(m: Mat4): Mat4 | undefined {
  const a00 = mAt(m, 0, 0);
  const a01 = mAt(m, 1, 0);
  const a02 = mAt(m, 2, 0);
  const a03 = mAt(m, 3, 0);
  const a10 = mAt(m, 0, 1);
  const a11 = mAt(m, 1, 1);
  const a12 = mAt(m, 2, 1);
  const a13 = mAt(m, 3, 1);
  const a20 = mAt(m, 0, 2);
  const a21 = mAt(m, 1, 2);
  const a22 = mAt(m, 2, 2);
  const a23 = mAt(m, 3, 2);
  const a30 = mAt(m, 0, 3);
  const a31 = mAt(m, 1, 3);
  const a32 = mAt(m, 2, 3);
  const a33 = mAt(m, 3, 3);
  const b00 = det3(a11, a12, a13, a21, a22, a23, a31, a32, a33);
  const b01 = -det3(a10, a12, a13, a20, a22, a23, a30, a32, a33);
  const b02 = det3(a10, a11, a13, a20, a21, a23, a30, a31, a33);
  const b03 = -det3(a10, a11, a12, a20, a21, a22, a30, a31, a32);
  const b10 = -det3(a01, a02, a03, a21, a22, a23, a31, a32, a33);
  const b11 = det3(a00, a02, a03, a20, a22, a23, a30, a32, a33);
  const b12 = -det3(a00, a01, a03, a20, a21, a23, a30, a31, a33);
  const b13 = det3(a00, a01, a02, a20, a21, a22, a30, a31, a32);
  const b20 = det3(a01, a02, a03, a11, a12, a13, a31, a32, a33);
  const b21 = -det3(a00, a02, a03, a10, a12, a13, a30, a32, a33);
  const b22 = det3(a00, a01, a03, a10, a11, a13, a30, a31, a33);
  const b23 = -det3(a00, a01, a02, a10, a11, a12, a30, a31, a32);
  const b30 = -det3(a01, a02, a03, a11, a12, a13, a21, a22, a23);
  const b31 = det3(a00, a02, a03, a10, a12, a13, a20, a22, a23);
  const b32 = -det3(a00, a01, a03, a10, a11, a13, a20, a21, a23);
  const b33 = det3(a00, a01, a02, a10, a11, a12, a20, a21, a22);
  const det = a00 * b00 + a01 * b01 + a02 * b02 + a03 * b03;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) {
    return undefined;
  }
  const invDet = 1 / det;
  return [
    b00 * invDet,
    b01 * invDet,
    b02 * invDet,
    b03 * invDet,
    b10 * invDet,
    b11 * invDet,
    b12 * invDet,
    b13 * invDet,
    b20 * invDet,
    b21 * invDet,
    b22 * invDet,
    b23 * invDet,
    b30 * invDet,
    b31 * invDet,
    b32 * invDet,
    b33 * invDet,
  ];
}

function colLength(m: Mat4, col: number): number {
  const x = mAt(m, col, 0);
  const y = mAt(m, col, 1);
  const z = mAt(m, col, 2);
  return Math.hypot(x, y, z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Decompose a TRS matrix into position, Euler XYZ degrees, and scale.
 *
 * @internal
 */
export function decomposeTrs(m: Mat4): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const sx = colLength(m, 0);
  const sy = colLength(m, 1);
  const sz = colLength(m, 2);
  const invSx = sx === 0 ? 0 : 1 / sx;
  const invSy = sy === 0 ? 0 : 1 / sy;
  const invSz = sz === 0 ? 0 : 1 / sz;
  const r00 = mAt(m, 0, 0) * invSx;
  const r10 = mAt(m, 0, 1) * invSx;
  const r20 = mAt(m, 0, 2) * invSx;
  const r11 = mAt(m, 1, 1) * invSy;
  const r21 = mAt(m, 1, 2) * invSy;
  const r12 = mAt(m, 2, 1) * invSz;
  const r22 = mAt(m, 2, 2) * invSz;
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
  return {
    position: [mAt(m, 3, 0), mAt(m, 3, 1), mAt(m, 3, 2)],
    rotation: [x * RAD, y * RAD, z * RAD],
    scale: [sx, sy, sz],
  };
}

/**
 * Transform a direction (w=0) by a matrix.
 *
 * @internal
 */
export function transformDir(m: Mat4, v: readonly [number, number, number]): Vec3 {
  return [
    mAt(m, 0, 0) * v[0] + mAt(m, 1, 0) * v[1] + mAt(m, 2, 0) * v[2],
    mAt(m, 0, 1) * v[0] + mAt(m, 1, 1) * v[1] + mAt(m, 2, 1) * v[2],
    mAt(m, 0, 2) * v[0] + mAt(m, 1, 2) * v[1] + mAt(m, 2, 2) * v[2],
  ];
}

/**
 * Recompute local TRS so world stays the same under a new parent world matrix.
 *
 * @internal
 */
export function keepWorldLocal(
  world: Mat4,
  newParentWorld: Mat4,
): { position: Vec3; rotation: Vec3; scale: Vec3 } | undefined {
  const invParent = invertMat4(newParentWorld);
  if (invParent === undefined) {
    return undefined;
  }
  return decomposeTrs(multiplyMat4(invParent, world));
}
