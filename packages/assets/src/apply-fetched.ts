import type { AssetId, EntityId } from "@tessera/schema";
import { AssetIdSchema } from "@tessera/schema";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, invariant, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";
import { createDefaultMaterial } from "./default-material.js";
import type { CommitPlanOptions, ImportPlan } from "./import-plan.js";
import { importGltf } from "./import-worker.js";
import type { FetchedAsset, SearchItem } from "./sources/polyhaven.js";

/**
 * Turns a fetched library item into an {@link ImportPlan} (`08` §6, INV-AST-02).
 *
 * @example
 * ```ts
 * await planFromFetched({ fetched, item, blobs, clock });
 * ```
 *
 * @public
 */
export async function planFromFetched(input: {
  readonly fetched: FetchedAsset;
  readonly item: SearchItem;
  readonly blobs: BlobStore;
  readonly clock: Clock;
  readonly signal?: AbortSignal;
  readonly setSky?: boolean;
}): Promise<Result<ImportPlan, TesseraError>> {
  const blob = input.fetched.blobs[0];
  if (blob === undefined) {
    return err(tesseraError("INVALID_INPUT", "fetched asset has no blob"));
  }
  if (input.item.kind === "model") {
    const body = await input.blobs.read(blob.hash, input.signal);
    if (!body.ok) {
      return body;
    }
    const bytes = new Uint8Array(await body.value.arrayBuffer());
    const plan = await importGltf({
      bytes,
      fileName: blob.fileName ?? `${input.item.id}.glb`,
      blobs: input.blobs,
      clock: input.clock,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (!plan.ok) {
      return plan;
    }
    return ok(stampLibrary(plan.value, input.fetched, input.item));
  }
  if (input.item.kind === "hdri") {
    const assetId = tempAssetId(0);
    return ok({
      blobs: input.fetched.blobs,
      assets: [
        {
          id: assetId,
          kind: "environment",
          name: input.item.name,
          license: input.fetched.license,
          provenance: input.fetched.provenance,
          source: { kind: "hdri", blob },
          rotation: 0,
          intensity: 1,
        },
      ],
      warnings: [],
      ...(input.fetched.attribution === undefined
        ? {}
        : { attribution: input.fetched.attribution }),
    });
  }
  const textureId = tempAssetId(0);
  const materialId = tempAssetId(1);
  const material = createDefaultMaterial({ id: materialId, createdAt: input.clock.nowIso() });
  const { createdAt: _createdAt, ...materialFields } = material;
  return ok({
    blobs: input.fetched.blobs,
    assets: [
      {
        id: textureId,
        kind: "texture",
        name: input.item.name,
        license: input.fetched.license,
        provenance: input.fetched.provenance,
        blob,
        colorSpace: "srgb",
        wrapS: "repeat",
        wrapT: "repeat",
        size: [1024, 1024],
        hasAlpha: false,
      },
      {
        ...materialFields,
        name: `${input.item.name} material`,
        license: input.fetched.license,
        provenance: input.fetched.provenance,
        baseColorTexture: { texture: textureId, texCoord: 0 },
      },
    ],
    warnings: [],
    ...(input.fetched.attribution === undefined ? {} : { attribution: input.fetched.attribution }),
  });
}

/**
 * After commit, optionally set sky or bind a material to a target entity.
 *
 * @public
 */
export function postCommitApply(input: {
  readonly item: SearchItem;
  readonly assetIds: readonly AssetId[];
  readonly options: CommitPlanOptions & { readonly setSky?: boolean; readonly target?: EntityId };
  readonly run: (name: string, payload: unknown) => Result<unknown, TesseraError>;
}): Result<void, TesseraError> {
  if (input.item.kind === "hdri" && input.options.setSky === true) {
    const envId = input.assetIds[0];
    if (envId === undefined) {
      return err(tesseraError("INVARIANT_VIOLATION", "HDRI commit missing asset id"));
    }
    const sky = input.run("environment.set", {
      patch: { sky: { kind: "environment", asset: envId } },
    });
    if (!sky.ok) {
      return sky;
    }
    return ok(undefined);
  }
  if (input.item.kind === "texture" && input.options.target !== undefined) {
    const materialId = input.assetIds[1] ?? input.assetIds[0];
    if (materialId === undefined) {
      return err(tesseraError("INVARIANT_VIOLATION", "texture commit missing material id"));
    }
    const updated = input.run("material.assign", {
      target: input.options.target,
      material: materialId,
    });
    if (!updated.ok) {
      return updated;
    }
  }
  return ok(undefined);
}

function tempAssetId(index: number): AssetId {
  const parsed = AssetIdSchema.safeParse(`a_${index.toString(36).padStart(10, "0")}`);
  invariant(parsed.success, "temporary asset id");
  return parsed.data;
}

function stampLibrary(plan: ImportPlan, fetched: FetchedAsset, item: SearchItem): ImportPlan {
  return {
    ...plan,
    assets: plan.assets.map((asset) => ({
      ...asset,
      license: fetched.license,
      provenance: {
        ...fetched.provenance,
        ...(asset.provenance.derivedFrom === undefined
          ? {}
          : { derivedFrom: asset.provenance.derivedFrom }),
      },
    })),
    ...(fetched.attribution === undefined ? {} : { attribution: fetched.attribution }),
    warnings: [...plan.warnings, `imported ${item.kind} ${item.id}`],
  };
}
