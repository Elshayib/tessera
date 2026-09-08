import type { Asset, Document } from "@tessera/schema";
import { assetGetQuery, assetListQuery } from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineQuery } from "./define.js";

export const assetGet = defineQuery(assetGetQuery, (ctx, input) => {
  const asset = ctx.doc.getAsset(input.id);
  if (asset === undefined) {
    return err(tesseraError("NOT_FOUND", "asset missing", { id: input.id }));
  }
  return ok(asset);
});

export const assetList = defineQuery(assetListQuery, (ctx, input) => {
  const snapshot = ctx.doc.snapshot();
  const listed: Asset[] = [];
  for (const asset of Object.values(snapshot.assets)) {
    if (input.kind !== undefined && asset.kind !== input.kind) {
      continue;
    }
    if (input.unused === true && isReferenced(snapshot, asset.id)) {
      continue;
    }
    if (input.unused === false && !isReferenced(snapshot, asset.id)) {
      continue;
    }
    listed.push(asset);
  }
  return ok(listed);
});

function isReferenced(snapshot: Document, id: string): boolean {
  const text = JSON.stringify({
    entities: snapshot.entities,
    assets: omitAsset(snapshot.assets, id),
    behaviors: snapshot.behaviors,
    environment: snapshot.environment,
  });
  return text.includes(id);
}

function omitAsset(assets: Document["assets"], id: string): Document["assets"] {
  const next: Document["assets"] = {};
  for (const [key, asset] of Object.entries(assets)) {
    if (key !== id) {
      next[key] = asset;
    }
  }
  return next;
}
