import type { AssetService, FetchedAsset, SearchItem } from "@tessera/assets";
import { importGltf } from "@tessera/assets";
import type { Author, CommandBus } from "@tessera/core";
import type { Clock, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { BlobStore } from "@tessera/storage";

/**
 * Creates an environment asset from a fetched HDRI and sets document sky (`08` §6).
 *
 * @example
 * ```ts
 * applyHdri(bus, fetched, item, { kind: "user", id: "u1" });
 * ```
 *
 * @public
 */
export function applyHdri(
  bus: CommandBus,
  fetched: FetchedAsset,
  item: SearchItem,
  author: Author,
): Result<{ readonly assetId: string }, TesseraError> {
  const blob = fetched.blobs[0];
  if (blob === undefined) {
    return err(tesseraError("INVALID_INPUT", "fetched HDRI has no blob"));
  }
  const result = bus.transaction({ author, label: `HDRI ${item.name}` }, (tx) => {
    const created = tx.run("asset.create", {
      asset: {
        kind: "environment",
        name: item.name,
        license: fetched.license,
        provenance: fetched.provenance,
        source: { kind: "hdri", blob },
      },
    });
    if (!created.ok) {
      return created;
    }
    const id = readId(created.value);
    if (id === undefined) {
      return err(tesseraError("INVARIANT_VIOLATION", "asset.create missing id"));
    }
    const sky = tx.run("environment.set", {
      patch: { sky: { kind: "environment", asset: id } },
    });
    if (!sky.ok) {
      return sky;
    }
    return ok({ assetId: id });
  });
  if (!result.ok) {
    return result;
  }
  return ok(result.value.value);
}

/**
 * Runs {@link importGltf} then {@link AssetService.commitPlan} for a fetched model (`INV-AST-02`).
 *
 * @example
 * ```ts
 * await applyFetchedModel(assets, blobs, clock, fetched, item, author, signal);
 * ```
 *
 * @public
 */
export async function applyFetchedModel(
  assets: AssetService,
  blobs: BlobStore,
  clock: Clock,
  fetched: FetchedAsset,
  item: SearchItem,
  author: Author,
  signal: AbortSignal,
): Promise<Result<{ readonly entityIds: readonly string[] }, TesseraError>> {
  const blob = fetched.blobs[0];
  if (blob === undefined) {
    return err(tesseraError("INVALID_INPUT", "fetched model has no blob"));
  }
  const body = await blobs.read(blob.hash, signal);
  if (!body.ok) {
    return body;
  }
  const bytes = new Uint8Array(await body.value.arrayBuffer());
  const plan = await importGltf({
    bytes,
    fileName: blob.fileName ?? `${item.id}.glb`,
    blobs,
    clock,
    signal,
  });
  if (!plan.ok) {
    return plan;
  }
  const committed = assets.commitPlan(plan.value, { author });
  if (!committed.ok) {
    return committed;
  }
  return ok({ entityIds: committed.value.entityIds });
}

function readId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return undefined;
  }
  const id = value.id;
  return typeof id === "string" ? id : undefined;
}
