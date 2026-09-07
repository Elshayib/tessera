import type { Asset, Entity } from "@tessera/schema";
import {
  AssetSchema,
  assetCreateCommand,
  assetDeleteCommand,
  assetUpdateCommand,
} from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import type { WriteContext } from "../command-types.js";
import { collectBlobHashes, defineCommand, isRecord, uniqueAssetName } from "./helpers.js";

function assetKindCannotChange(existing: Asset, patch: object): boolean {
  if (!isRecord(patch)) {
    return false;
  }
  const kind = patch["kind"];
  return typeof kind === "string" && kind !== existing.kind;
}

export const assetCreate = defineCommand(assetCreateCommand, {
  validate(ctx, input) {
    const hashes: string[] = [];
    collectBlobHashes(input.asset, hashes);
    if (ctx.blobs !== undefined) {
      for (const hash of hashes) {
        if (!ctx.blobs.has(hash)) {
          return err(tesseraError("NOT_FOUND", "blob missing", { hash }));
        }
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const named = uniqueAssetName(ctx.doc.snapshot(), input.asset.kind, input.asset.name);
    if (!named.ok) {
      return named;
    }
    const parsed = AssetSchema.safeParse({
      ...input.asset,
      id: ctx.newId("a"),
      name: named.value,
      createdAt: ctx.clock.nowIso(),
    });
    if (!parsed.success) {
      return err(tesseraError("INVALID_INPUT", "invalid asset", { issues: parsed.error.issues }));
    }
    const created = ctx.write.createAsset(parsed.data);
    if (!created.ok) {
      return created;
    }
    return ok({ id: parsed.data.id });
  },
});

export const assetUpdate = defineCommand(assetUpdateCommand, {
  validate(ctx, input) {
    const asset = ctx.doc.getAsset(input.target);
    if (asset === undefined) {
      return err(tesseraError("NOT_FOUND", "asset missing", { id: input.target }));
    }
    if (assetKindCannotChange(asset, input.patch)) {
      return err(tesseraError("CONFLICT", "asset kind cannot change"));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const asset = ctx.doc.getAsset(input.target);
    if (asset === undefined) {
      return err(tesseraError("NOT_FOUND", "asset missing", { id: input.target }));
    }
    const parsed = AssetSchema.safeParse({
      ...asset,
      ...input.patch,
      kind: asset.kind,
      id: asset.id,
    });
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid asset patch", { issues: parsed.error.issues }),
      );
    }
    const updated = ctx.write.updateAsset(parsed.data);
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});

function referencedBy(
  snapshotEntities: readonly Entity[],
  snapshotAssets: readonly Asset[],
  snapshotBehaviors: object,
  environment: object,
  id: string,
): boolean {
  const text = JSON.stringify({
    entities: snapshotEntities,
    assets: snapshotAssets,
    behaviors: snapshotBehaviors,
    environment,
  });
  return text.includes(id);
}

export const assetDelete = defineCommand(assetDeleteCommand, {
  validate(ctx, input) {
    const asset = ctx.doc.getAsset(input.target);
    if (asset === undefined) {
      return err(tesseraError("NOT_FOUND", "asset missing", { id: input.target }));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const snapshot = ctx.doc.snapshot();
    const asset = snapshot.assets[input.target];
    if (asset === undefined) {
      return err(tesseraError("NOT_FOUND", "asset missing", { id: input.target }));
    }
    const entities = Object.values(snapshot.entities);
    const assets = Object.values(snapshot.assets).filter((entry) => entry.id !== input.target);
    const referenced = referencedBy(
      entities,
      assets,
      snapshot.behaviors,
      snapshot.environment,
      input.target,
    );
    if (referenced && input.force !== true) {
      return err(tesseraError("CONFLICT", "asset is referenced", { id: input.target }));
    }
    if (referenced && input.force === true) {
      const cleared = clearAssetRefs(ctx, input.target);
      if (!cleared.ok) {
        return cleared;
      }
    }
    const deleted = ctx.write.deleteAsset(input.target);
    if (!deleted.ok) {
      return deleted;
    }
    return ok({});
  },
});

function clearAssetRefs(
  ctx: WriteContext,
  id: string,
): ReturnType<WriteContext["write"]["deleteAsset"]> {
  const snapshot = ctx.doc.snapshot();
  if (snapshot.environment.sky.kind === "environment" && snapshot.environment.sky.asset === id) {
    const env = ctx.write.setEnvironment({
      ...snapshot.environment,
      sky: { kind: "none" },
    });
    if (!env.ok) {
      return env;
    }
  }
  for (const entity of Object.values(snapshot.entities)) {
    const renderer = entity.components.meshRenderer;
    if (renderer === undefined) {
      continue;
    }
    let next = renderer;
    let changed = false;
    if (renderer.geometry === id) {
      const components = { ...entity.components };
      delete components.meshRenderer;
      const updated = ctx.write.updateEntity({ ...entity, components });
      if (!updated.ok) {
        return updated;
      }
      continue;
    }
    const materials = renderer.materials.filter((materialId) => materialId !== id);
    if (materials.length !== renderer.materials.length) {
      next = { ...renderer, materials };
      changed = true;
    }
    if (changed) {
      const updated = ctx.write.updateEntity({
        ...entity,
        components: { ...entity.components, meshRenderer: next },
      });
      if (!updated.ok) {
        return updated;
      }
    }
  }
  for (const other of Object.values(snapshot.assets)) {
    if (other.id === id || other.kind !== "material") {
      continue;
    }
    const slots = [
      "baseColorTexture",
      "metallicRoughnessTexture",
      "normalTexture",
      "occlusionTexture",
      "emissiveTexture",
    ] as const;
    let material = other;
    let changed = false;
    for (const slot of slots) {
      const value = material[slot];
      if (value !== undefined && value.texture === id) {
        material = { ...material, [slot]: undefined };
        changed = true;
      }
    }
    if (changed) {
      const updated = ctx.write.updateAsset(material);
      if (!updated.ok) {
        return updated;
      }
    }
  }
  for (const behavior of Object.values(snapshot.behaviors)) {
    if (behavior.script === id) {
      const deleted = ctx.write.deleteBehavior(behavior.id);
      if (!deleted.ok) {
        return deleted;
      }
    }
  }
  return ok(undefined);
}
