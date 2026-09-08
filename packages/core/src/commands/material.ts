import {
  MaterialAssetSchema,
  materialAssignCommand,
  materialCreateCommand,
  materialSetCommand,
} from "@tessera/schema";
import { err, ok, tesseraError } from "@tessera/std";
import { defineCommand, resolveEntityRef, uniqueAssetName } from "./helpers.js";

const DEFAULT_MATERIAL_NAME = "Material";
const DEFAULT_MATERIAL_LICENSE = "unknown";

export const materialCreate = defineCommand(materialCreateCommand, {
  validate() {
    return ok(undefined);
  },
  handle(ctx, input) {
    const desired = input.name ?? DEFAULT_MATERIAL_NAME;
    const named = uniqueAssetName(ctx.doc.snapshot(), "material", desired);
    if (!named.ok) {
      return named;
    }
    const parsed = MaterialAssetSchema.safeParse({
      id: ctx.newId("a"),
      kind: "material",
      name: named.value,
      license: input.license ?? DEFAULT_MATERIAL_LICENSE,
      provenance: {
        source: input.provenance?.source ?? "derived",
        sourceId: input.provenance?.sourceId,
        sourceUrl: input.provenance?.sourceUrl,
        author: input.provenance?.author,
        importedAt: ctx.clock.nowIso(),
      },
      createdAt: ctx.clock.nowIso(),
      ...input.material,
    });
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid material", { issues: parsed.error.issues }),
      );
    }
    const created = ctx.write.createAsset(parsed.data);
    if (!created.ok) {
      return created;
    }
    return ok({ id: parsed.data.id });
  },
});

export const materialSet = defineCommand(materialSetCommand, {
  validate(ctx, input) {
    const asset = ctx.doc.getAsset(input.target);
    if (asset === undefined || asset.kind !== "material") {
      return err(tesseraError("NOT_FOUND", "material missing", { id: input.target }));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const asset = ctx.doc.getAsset(input.target);
    if (asset === undefined || asset.kind !== "material") {
      return err(tesseraError("NOT_FOUND", "material missing", { id: input.target }));
    }
    const parsed = MaterialAssetSchema.safeParse({ ...asset, ...input.patch, kind: "material" });
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid material patch", { issues: parsed.error.issues }),
      );
    }
    const updated = ctx.write.updateAsset(parsed.data);
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});

export const materialAssign = defineCommand(materialAssignCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (target.value.components.meshRenderer === undefined) {
      return err(tesseraError("CONFLICT", "entity has no meshRenderer"));
    }
    const material = ctx.doc.getAsset(input.material);
    if (material === undefined || material.kind !== "material") {
      return err(tesseraError("NOT_FOUND", "material missing", { id: input.material }));
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const renderer = target.value.components.meshRenderer;
    if (renderer === undefined) {
      return err(tesseraError("CONFLICT", "entity has no meshRenderer"));
    }
    let materials = [...renderer.materials];
    if (input.slot === undefined) {
      if (materials.length === 0) {
        materials = [input.material];
      } else {
        materials = materials.map(() => input.material);
      }
    } else {
      while (materials.length <= input.slot) {
        const last = materials[materials.length - 1] ?? input.material;
        materials.push(last);
      }
      materials[input.slot] = input.material;
    }
    const updated = ctx.write.updateEntity({
      ...target.value,
      components: {
        ...target.value.components,
        meshRenderer: { ...renderer, materials },
      },
    });
    if (!updated.ok) {
      return updated;
    }
    return ok({ materials });
  },
});
