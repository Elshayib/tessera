import { invariant } from "@tessera/std";

type Vec3 = readonly [number, number, number];

/** Column-major 4×4 matrix. */
type Mat4 = readonly [
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

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function identityMat4(): Mat4 {
  return IDENTITY;
}

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

export function transformPoint(m: Mat4, v: readonly [number, number, number]): Vec3 {
  return [
    mAt(m, 0, 0) * v[0] + mAt(m, 1, 0) * v[1] + mAt(m, 2, 0) * v[2] + mAt(m, 3, 0),
    mAt(m, 0, 1) * v[0] + mAt(m, 1, 1) * v[1] + mAt(m, 2, 1) * v[2] + mAt(m, 3, 1),
    mAt(m, 0, 2) * v[0] + mAt(m, 1, 2) * v[1] + mAt(m, 2, 2) * v[2] + mAt(m, 3, 2),
  ];
}
