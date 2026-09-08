import type { AssetId, MaterialAsset } from "@tessera/schema";
import { MaterialAssetSchema } from "@tessera/schema";
import { invariant } from "@tessera/std";

const DEFAULT_MATERIAL_NAME = "Material";
const DEFAULT_MATERIAL_LICENSE = "unknown";

/**
 * Options for {@link createDefaultMaterial}.
 *
 * @public
 */
export interface CreateDefaultMaterialOptions {
  readonly id: AssetId;
  readonly createdAt: string;
}

/**
 * Built-in PBR material for new primitives (`03` §6.3 empty slots, Q-0014).
 *
 * @example
 * ```ts
 * const material = createDefaultMaterial({
 *   id: "a_aaaaaaaaaa",
 *   createdAt: "2026-01-01T00:00:00.000Z",
 * });
 * ```
 *
 * @public
 */
export function createDefaultMaterial(options: CreateDefaultMaterialOptions): MaterialAsset {
  const parsed = MaterialAssetSchema.safeParse({
    id: options.id,
    name: DEFAULT_MATERIAL_NAME,
    license: DEFAULT_MATERIAL_LICENSE,
    provenance: {
      source: "derived",
      importedAt: options.createdAt,
    },
    createdAt: options.createdAt,
    kind: "material",
  });
  if (!parsed.success) {
    invariant(false, "default material must satisfy MaterialAssetSchema");
  }
  return parsed.data;
}
