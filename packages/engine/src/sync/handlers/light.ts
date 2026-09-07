import type { Light } from "@tessera/schema";
import type { Group, Object3D } from "three";
import { DirectionalLight, MathUtils, PointLight, RectAreaLight, SpotLight } from "three";

/**
 * Mirrors `light` onto an entity group (`05` §4.1).
 *
 * @internal
 */
export function syncLight(group: Group, light: Light | undefined): void {
  const existing = group.children.filter((child) => child.userData["tesseraKind"] === "light");
  for (const child of existing) {
    group.remove(child);
  }
  if (light === undefined) {
    return;
  }
  const object = createLight(light);
  object.userData["tesseraKind"] = "light";
  object.userData["hash"] = light;
  object.castShadow = light.castShadow;
  group.add(object);
  if (object instanceof DirectionalLight || object instanceof SpotLight) {
    object.target.position.set(0, 0, -1);
    object.target.userData["tesseraKind"] = "light-target";
    group.add(object.target);
  }
}

function createLight(light: Light): Object3D {
  switch (light.type) {
    case "directional": {
      const object = new DirectionalLight(light.color, light.intensity);
      return object;
    }
    case "point": {
      const object = new PointLight(light.color, light.intensity, light.range);
      return object;
    }
    case "spot": {
      const object = new SpotLight(light.color, light.intensity, light.range);
      object.angle = MathUtils.degToRad(light.angle);
      object.penumbra = light.penumbra;
      return object;
    }
    case "area": {
      const object = new RectAreaLight(light.color, light.intensity, light.size[0], light.size[1]);
      return object;
    }
  }
}
