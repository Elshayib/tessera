import type { Primitive } from "@tessera/schema";

/**
 * Triangle mesh produced from a schema primitive (`09` §3.2).
 *
 * @public
 */
export interface PrimitiveMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * Generates positions, normals, uvs, and triangle indices for `primitive`.
 *
 * @example
 * ```ts
 * const mesh = createPrimitiveMesh({ type: "box", size: [1, 1, 1] });
 * ```
 *
 * @public
 */
export function createPrimitiveMesh(primitive: Primitive): PrimitiveMesh {
  switch (primitive.type) {
    case "box":
      return boxMesh(primitive.size[0], primitive.size[1], primitive.size[2]);
    case "sphere":
      return sphereMesh(primitive.radius, primitive.segments);
    case "cylinder":
      return cylinderMesh(
        primitive.radiusTop,
        primitive.radiusBottom,
        primitive.height,
        primitive.segments,
        true,
        true,
      );
    case "cone":
      return cylinderMesh(0, primitive.radius, primitive.height, primitive.segments, false, true);
    case "plane":
      return planeMesh(primitive.size[0], primitive.size[1]);
    case "torus":
      return torusMesh(
        primitive.radius,
        primitive.tube,
        primitive.radialSegments,
        primitive.tubularSegments,
      );
    case "capsule":
      return capsuleMesh(primitive.radius, primitive.height, primitive.segments);
  }
}

function boxMesh(width: number, height: number, depth: number): PrimitiveMesh {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  const builder = new Builder();
  addQuad(builder, [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz], [1, 0, 0]);
  addQuad(builder, [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz], [-1, 0, 0]);
  addQuad(builder, [-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [0, 1, 0]);
  addQuad(builder, [-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [0, -1, 0]);
  addQuad(builder, [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [-hx, -hy, hz], [0, 0, 1]);
  addQuad(builder, [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz], [0, 0, -1]);
  return builder.finish();
}

function planeMesh(width: number, depth: number): PrimitiveMesh {
  const hx = width / 2;
  const hz = depth / 2;
  const builder = new Builder();
  addQuad(builder, [-hx, 0, hz], [-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [0, 1, 0]);
  return builder.finish();
}

function sphereMesh(radius: number, segments: number): PrimitiveMesh {
  const builder = new Builder();
  const width = Math.max(3, segments);
  const height = Math.max(2, segments);
  for (let y = 0; y <= height; y += 1) {
    const v = y / height;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= width; x += 1) {
      const u = x / width;
      const theta = u * Math.PI * 2;
      const nx = -Math.sin(theta) * sinPhi;
      const ny = cosPhi;
      const nz = Math.cos(theta) * sinPhi;
      builder.vertex(nx * radius, ny * radius, nz * radius, nx, ny, nz, u, 1 - v);
    }
  }
  const stride = width + 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = y * stride + x;
      const b = a + stride;
      builder.tri(a, b, a + 1);
      builder.tri(a + 1, b, b + 1);
    }
  }
  return builder.finish();
}

function cylinderMesh(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  capTop: boolean,
  capBottom: boolean,
): PrimitiveMesh {
  const builder = new Builder();
  const radial = Math.max(3, segments);
  const hy = height / 2;
  const slope = (radiusBottom - radiusTop) / height;
  for (let i = 0; i <= radial; i += 1) {
    const u = i / radial;
    const theta = u * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const nx = cos;
    const ny = slope;
    const nz = sin;
    const length = Math.hypot(nx, ny, nz) || 1;
    builder.vertex(
      cos * radiusTop,
      hy,
      sin * radiusTop,
      nx / length,
      ny / length,
      nz / length,
      u,
      1,
    );
    builder.vertex(
      cos * radiusBottom,
      -hy,
      sin * radiusBottom,
      nx / length,
      ny / length,
      nz / length,
      u,
      0,
    );
  }
  for (let i = 0; i < radial; i += 1) {
    const topA = i * 2;
    const bottomA = topA + 1;
    const topB = (i + 1) * 2;
    const bottomB = topB + 1;
    builder.tri(topA, bottomA, topB);
    builder.tri(topB, bottomA, bottomB);
  }
  if (capTop && radiusTop > 0) {
    addCap(builder, radiusTop, hy, radial, [0, 1, 0], true);
  }
  if (capBottom && radiusBottom > 0) {
    addCap(builder, radiusBottom, -hy, radial, [0, -1, 0], false);
  }
  return builder.finish();
}

function addCap(
  builder: Builder,
  radius: number,
  y: number,
  radial: number,
  normal: readonly [number, number, number],
  top: boolean,
): void {
  const center = builder.vertex(0, y, 0, normal[0], normal[1], normal[2], 0.5, 0.5);
  for (let i = 0; i <= radial; i += 1) {
    const u = i / radial;
    const theta = u * Math.PI * 2;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    builder.vertex(
      x,
      y,
      z,
      normal[0],
      normal[1],
      normal[2],
      (Math.cos(theta) + 1) / 2,
      (Math.sin(theta) + 1) / 2,
    );
  }
  for (let i = 0; i < radial; i += 1) {
    const a = center + 1 + i;
    const b = a + 1;
    if (top) {
      builder.tri(center, a, b);
    } else {
      builder.tri(center, b, a);
    }
  }
}

function torusMesh(
  radius: number,
  tube: number,
  radialSegments: number,
  tubularSegments: number,
): PrimitiveMesh {
  const builder = new Builder();
  const radial = Math.max(3, radialSegments);
  const tubular = Math.max(3, tubularSegments);
  for (let j = 0; j <= radial; j += 1) {
    const v = j / radial;
    const phi = v * Math.PI * 2;
    for (let i = 0; i <= tubular; i += 1) {
      const u = i / tubular;
      const theta = u * Math.PI * 2;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const x = (radius + tube * cosPhi) * cosTheta;
      const y = tube * sinPhi;
      const z = (radius + tube * cosPhi) * sinTheta;
      const nx = cosPhi * cosTheta;
      const ny = sinPhi;
      const nz = cosPhi * sinTheta;
      builder.vertex(x, y, z, nx, ny, nz, u, v);
    }
  }
  const stride = tubular + 1;
  for (let j = 0; j < radial; j += 1) {
    for (let i = 0; i < tubular; i += 1) {
      const a = j * stride + i;
      const b = a + stride;
      builder.tri(a, b, a + 1);
      builder.tri(a + 1, b, b + 1);
    }
  }
  return builder.finish();
}

function capsuleMesh(radius: number, height: number, segments: number): PrimitiveMesh {
  const builder = new Builder();
  const radial = Math.max(3, segments);
  const rings = Math.max(2, Math.ceil(segments / 2));
  const cylinder = Math.max(0, height - 2 * radius);
  const hy = cylinder / 2;
  const topCenter = hy;
  const bottomCenter = -hy;
  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = (v * Math.PI) / 2;
    addCapsuleRing(
      builder,
      radius,
      topCenter + Math.sin(phi) * radius,
      Math.sin(phi),
      radial,
      (1 + v) / 2,
    );
  }
  for (let y = 0; y <= rings; y += 1) {
    const v = y / rings;
    const phi = (v * Math.PI) / 2;
    addCapsuleRing(
      builder,
      radius,
      bottomCenter - Math.sin(phi) * radius,
      -Math.sin(phi),
      radial,
      (1 - v) / 2,
    );
  }
  const stride = radial + 1;
  const topStart = 0;
  const bottomStart = (rings + 1) * stride;
  for (let y = 0; y < rings; y += 1) {
    stitchRing(builder, topStart + y * stride, stride, radial);
    stitchRing(builder, bottomStart + y * stride, stride, radial);
  }
  const topEquator = topStart + rings * stride;
  const bottomEquator = bottomStart;
  for (let i = 0; i < radial; i += 1) {
    const a = topEquator + i;
    const b = bottomEquator + i;
    builder.tri(a, b, a + 1);
    builder.tri(a + 1, b, b + 1);
  }
  return builder.finish();
}

function addCapsuleRing(
  builder: Builder,
  radius: number,
  y: number,
  nY: number,
  radial: number,
  v: number,
): void {
  const ringRadius = radius * Math.sqrt(Math.max(0, 1 - nY * nY));
  for (let i = 0; i <= radial; i += 1) {
    const u = i / radial;
    const theta = u * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const nx = cos * Math.sqrt(Math.max(0, 1 - nY * nY));
    const nz = sin * Math.sqrt(Math.max(0, 1 - nY * nY));
    const length = Math.hypot(nx, nY, nz) || 1;
    builder.vertex(
      cos * ringRadius,
      y,
      sin * ringRadius,
      nx / length,
      nY / length,
      nz / length,
      u,
      v,
    );
  }
}

function stitchRing(builder: Builder, start: number, stride: number, radial: number): void {
  for (let i = 0; i < radial; i += 1) {
    const a = start + i;
    const b = a + stride;
    builder.tri(a, b, a + 1);
    builder.tri(a + 1, b, b + 1);
  }
}

function addQuad(
  builder: Builder,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  d: readonly [number, number, number],
  normal: readonly [number, number, number],
): void {
  const ia = builder.vertex(a[0], a[1], a[2], normal[0], normal[1], normal[2], 0, 0);
  const ib = builder.vertex(b[0], b[1], b[2], normal[0], normal[1], normal[2], 0, 1);
  const ic = builder.vertex(c[0], c[1], c[2], normal[0], normal[1], normal[2], 1, 1);
  const id = builder.vertex(d[0], d[1], d[2], normal[0], normal[1], normal[2], 1, 0);
  builder.tri(ia, ib, ic);
  builder.tri(ia, ic, id);
}

class Builder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
  ): number {
    const index = this.positions.length / 3;
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    return index;
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  finish(): PrimitiveMesh {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      indices: new Uint32Array(this.indices),
    };
  }
}
