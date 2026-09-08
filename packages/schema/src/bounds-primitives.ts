import type { Primitive } from "./assets/geometry.js";
import type { Vec3 } from "./primitives.js";

export interface Aabb {
  readonly min: Vec3;
  readonly max: Vec3;
}

/**
 * Analytic local-space AABB for a geometry primitive (`03` §6.2).
 *
 * @public
 */
export function primitiveBounds(primitive: Primitive): Aabb {
  switch (primitive.type) {
    case "box": {
      const [x, y, z] = primitive.size;
      return { min: [-x / 2, -y / 2, -z / 2], max: [x / 2, y / 2, z / 2] };
    }
    case "sphere": {
      const r = primitive.radius;
      return { min: [-r, -r, -r], max: [r, r, r] };
    }
    case "cylinder": {
      const radius = Math.max(primitive.radiusTop, primitive.radiusBottom);
      const h = primitive.height / 2;
      return { min: [-radius, -h, -radius], max: [radius, h, radius] };
    }
    case "cone": {
      const r = primitive.radius;
      const h = primitive.height / 2;
      return { min: [-r, -h, -r], max: [r, h, r] };
    }
    case "plane": {
      const [w, d] = primitive.size;
      return { min: [-w / 2, 0, -d / 2], max: [w / 2, 0, d / 2] };
    }
    case "torus": {
      const extent = primitive.radius + primitive.tube;
      return { min: [-extent, -primitive.tube, -extent], max: [extent, primitive.tube, extent] };
    }
    case "capsule": {
      const r = primitive.radius;
      const h = primitive.height / 2;
      return { min: [-r, -h, -r], max: [r, h, r] };
    }
  }
}
