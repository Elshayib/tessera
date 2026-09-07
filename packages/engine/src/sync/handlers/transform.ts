import type { Transform } from "@tessera/schema";
import type { Object3D } from "three";
import { MathUtils } from "three";

/**
 * Applies document transform to an Object3D (meters, Euler XYZ degrees → radians).
 *
 * @internal
 */
export function applyTransform(object: Object3D, transform: Transform): void {
  object.position.set(transform.position[0], transform.position[1], transform.position[2]);
  object.rotation.order = "XYZ";
  object.rotation.set(
    MathUtils.degToRad(transform.rotation[0]),
    MathUtils.degToRad(transform.rotation[1]),
    MathUtils.degToRad(transform.rotation[2]),
  );
  object.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
  object.updateMatrix();
}
