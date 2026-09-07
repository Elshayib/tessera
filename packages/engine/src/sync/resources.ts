import { createDefaultMaterial, createPrimitiveMesh } from "@tessera/assets";
import type { Asset, GeometryAsset, MaterialAsset } from "@tessera/schema";
import type { Logger } from "@tessera/std";
import type { Material } from "three";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
} from "three";
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";

const DEFAULT_MATERIAL_ID = "a_default000";
const DEFAULT_CREATED_AT = "2026-01-01T00:00:00.000Z";

/**
 * Geometry and material caches with refcounts (`05` §4.4). Grace-period dispose is T-0107+.
 *
 * @internal
 */
export class ResourceCaches {
  readonly geometries = new Map<string, { readonly value: BufferGeometry; refs: number }>();
  readonly materials = new Map<string, { readonly value: Material; refs: number }>();
  readonly failed = new Set<string>();
  readonly placeholderGeometry: BufferGeometry;
  readonly placeholderMaterial: Material;
  readonly defaultMaterial: Material;
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
    this.placeholderGeometry = new BoxGeometry(1, 1, 1);
    this.placeholderMaterial = magentaChecker();
    this.defaultMaterial = materialFromAsset(
      createDefaultMaterial({ id: DEFAULT_MATERIAL_ID, createdAt: DEFAULT_CREATED_AT }),
    );
  }

  acquireGeometry(asset: Asset | undefined): BufferGeometry {
    if (asset === undefined || asset.kind !== "geometry") {
      this.#fail("missing");
      return this.placeholderGeometry;
    }
    const existing = this.geometries.get(asset.id);
    if (existing !== undefined) {
      existing.refs += 1;
      return existing.value;
    }
    const built = geometryFromAsset(asset, this.#logger, this.failed);
    this.geometries.set(asset.id, { value: built, refs: 1 });
    return built;
  }

  releaseGeometry(id: string | undefined): void {
    if (id === undefined) {
      return;
    }
    const entry = this.geometries.get(id);
    if (entry === undefined) {
      return;
    }
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.value.dispose();
      this.geometries.delete(id);
    }
  }

  acquireMaterial(asset: Asset | undefined): Material {
    if (asset === undefined || asset.kind !== "material") {
      return this.defaultMaterial;
    }
    const existing = this.materials.get(asset.id);
    if (existing !== undefined) {
      existing.refs += 1;
      return existing.value;
    }
    const built = materialFromAsset(asset);
    this.materials.set(asset.id, { value: built, refs: 1 });
    return built;
  }

  releaseMaterial(id: string | undefined): void {
    if (id === undefined) {
      return;
    }
    const entry = this.materials.get(id);
    if (entry === undefined) {
      return;
    }
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.value.dispose();
      this.materials.delete(id);
    }
  }

  dispose(): void {
    for (const entry of this.geometries.values()) {
      entry.value.dispose();
    }
    this.geometries.clear();
    for (const entry of this.materials.values()) {
      entry.value.dispose();
    }
    this.materials.clear();
    this.placeholderGeometry.dispose();
    this.placeholderMaterial.dispose();
    this.defaultMaterial.dispose();
  }

  #fail(hash: string): void {
    this.failed.add(hash);
    this.#logger.error("engine.assets.load_failed", { hash });
  }
}

function geometryFromAsset(
  asset: GeometryAsset,
  logger: Logger,
  failed: Set<string>,
): BufferGeometry {
  if (asset.source.kind !== "primitive") {
    failed.add(asset.id);
    logger.error("engine.assets.load_failed", { hash: asset.id });
    return new BoxGeometry(1, 1, 1);
  }
  const mesh = createPrimitiveMesh(asset.source.primitive);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(mesh.normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(mesh.uvs, 2));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  return geometry;
}

function materialFromAsset(asset: MaterialAsset): Material {
  const color = new Color(asset.baseColor);
  const emissive = new Color(asset.emissive);
  if (asset.model === "unlit") {
    const material = new MeshBasicNodeMaterial();
    material.color = color;
    material.opacity = asset.opacity;
    material.transparent = asset.opacity < 1;
    material.side = asset.doubleSided ? DoubleSide : material.side;
    return material;
  }
  const physical = asset.transmission !== undefined || asset.clearcoat !== undefined;
  const material = physical ? new MeshPhysicalNodeMaterial() : new MeshStandardNodeMaterial();
  material.color = color;
  material.metalness = asset.metallic;
  material.roughness = asset.roughness;
  material.emissive = emissive;
  material.emissiveIntensity = asset.emissiveStrength;
  material.opacity = asset.opacity;
  material.transparent = asset.opacity < 1;
  material.side = asset.doubleSided ? DoubleSide : material.side;
  if (material instanceof MeshPhysicalNodeMaterial) {
    if (asset.transmission !== undefined) {
      material.transmission = asset.transmission;
    }
    if (asset.clearcoat !== undefined) {
      material.clearcoat = asset.clearcoat;
    }
    if (asset.clearcoatRoughness !== undefined) {
      material.clearcoatRoughness = asset.clearcoatRoughness;
    }
    if (asset.ior !== undefined) {
      material.ior = asset.ior;
    }
    if (asset.thickness !== undefined) {
      material.thickness = asset.thickness;
    }
  }
  return material;
}

function magentaChecker(): Material {
  const data = new Uint8Array([255, 0, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 0, 255, 255]);
  const map = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType);
  map.magFilter = NearestFilter;
  map.minFilter = NearestFilter;
  map.needsUpdate = true;
  const material = new MeshBasicNodeMaterial();
  material.map = map;
  material.wireframe = true;
  return material;
}
