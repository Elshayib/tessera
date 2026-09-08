import type { Asset, MeshRenderer } from "@tessera/schema";
import type { Group } from "three";
import { Mesh } from "three";
import type { ResourceCaches } from "../resources.js";

/**
 * Mirrors `meshRenderer` onto an entity group (`05` §4.1).
 *
 * @internal
 */
export function syncMesh(
  group: Group,
  meshRenderer: MeshRenderer | undefined,
  caches: ResourceCaches,
  getAsset: (id: string) => Asset | undefined,
): void {
  const existing = group.children.find((child) => child.userData["tesseraKind"] === "mesh");
  if (existing instanceof Mesh) {
    const geometryId = existing.userData["geometryId"];
    const materialId = existing.userData["materialId"];
    caches.releaseGeometry(typeof geometryId === "string" ? geometryId : undefined);
    caches.releaseMaterial(typeof materialId === "string" ? materialId : undefined);
    group.remove(existing);
  }
  if (meshRenderer === undefined) {
    return;
  }
  const geometryAsset = getAsset(meshRenderer.geometry);
  const geometry = caches.acquireGeometry(geometryAsset);
  const materialRef = lastMaterial(meshRenderer.materials);
  const materialAsset = materialRef === undefined ? undefined : getAsset(materialRef);
  const material = caches.acquireMaterial(materialAsset);
  const mesh = new Mesh(geometry, material);
  mesh.layers.set(0);
  mesh.castShadow = meshRenderer.castShadow;
  mesh.receiveShadow = meshRenderer.receiveShadow;
  mesh.visible = meshRenderer.visible;
  mesh.userData["tesseraKind"] = "mesh";
  mesh.userData["geometryId"] = geometryAsset?.id;
  mesh.userData["materialId"] = materialAsset?.id;
  mesh.userData["hash"] = {
    geometry: meshRenderer.geometry,
    materials: [...meshRenderer.materials],
    castShadow: meshRenderer.castShadow,
    receiveShadow: meshRenderer.receiveShadow,
    visible: meshRenderer.visible,
    placeholder: caches.failed.has(meshRenderer.geometry),
  };
  group.add(mesh);
}

function lastMaterial(materials: readonly string[]): string | undefined {
  return materials.length === 0 ? undefined : materials[materials.length - 1];
}
