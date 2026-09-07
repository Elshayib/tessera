import type { Object3D } from "three";

const ROUND = 1e6;

/**
 * Canonical structural hash of entity Object3Ds (`05` INV-RND-01 / INV-RND-02).
 *
 * @example
 * ```ts
 * structuralHash(scene);
 * ```
 *
 * @public
 */
export function structuralHash(root: Object3D): string {
  const nodes = collect(root).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify(nodes);
}

function collect(root: Object3D): HashNode[] {
  const nodes: HashNode[] = [];
  root.traverse((object) => {
    const id = object.userData["entityId"];
    if (typeof id !== "string") {
      return;
    }
    const mesh = childByKind(object, "mesh");
    const light = childByKind(object, "light");
    const camera = childByKind(object, "camera");
    nodes.push({
      id,
      visible: object.visible,
      position: roundVec(object.position.x, object.position.y, object.position.z),
      rotation: roundVec(object.rotation.x, object.rotation.y, object.rotation.z),
      scale: roundVec(object.scale.x, object.scale.y, object.scale.z),
      childIds: object.children
        .map((child) => child.userData["entityId"])
        .filter((value): value is string => typeof value === "string"),
      mesh: mesh === undefined ? null : mesh.userData["hash"],
      light: light === undefined ? null : light.userData["hash"],
      camera: camera === undefined ? null : camera.userData["hash"],
    });
  });
  return nodes;
}

function childByKind(object: Object3D, kind: string): Object3D | undefined {
  return object.children.find((child) => child.userData["tesseraKind"] === kind);
}

function roundVec(x: number, y: number, z: number): readonly [number, number, number] {
  return [
    Math.round(x * ROUND) / ROUND,
    Math.round(y * ROUND) / ROUND,
    Math.round(z * ROUND) / ROUND,
  ];
}

interface HashNode {
  readonly id: string;
  readonly visible: boolean;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly childIds: readonly string[];
  readonly mesh: unknown;
  readonly light: unknown;
  readonly camera: unknown;
}
