import type { Camera } from "@tessera/schema";
import type { Group, Object3D } from "three";
import { OrthographicCamera, PerspectiveCamera } from "three";

/**
 * Mirrors `camera` onto an entity group (`05` §4.1). Helpers wait for selection (T-0106).
 *
 * @internal
 */
export function syncCamera(group: Group, camera: Camera | undefined): void {
  const existing = group.children.filter((child) => child.userData["tesseraKind"] === "camera");
  for (const child of existing) {
    group.remove(child);
  }
  if (camera === undefined) {
    return;
  }
  const object = createCamera(camera);
  object.userData["tesseraKind"] = "camera";
  object.userData["hash"] = camera;
  group.add(object);
}

function createCamera(camera: Camera): Object3D {
  if (camera.type === "orthographic") {
    const size = camera.orthoSize;
    return new OrthographicCamera(-size, size, size, -size, camera.near, camera.far);
  }
  return new PerspectiveCamera(camera.fov, 1, camera.near, camera.far);
}
