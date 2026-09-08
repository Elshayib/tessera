import type { Entity } from "@tessera/schema";
import {
  ComponentsSchema,
  entityCreateCommand,
  entityDeleteCommand,
  entityDuplicateCommand,
  entityRenameCommand,
  entityReorderCommand,
  entitySetEnabledCommand,
  entitySetParentCommand,
  TransformSchema,
} from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { ReadContext } from "../command-types.js";
import {
  addVec3,
  cloneComponents,
  DEFAULT_ENTITY_NAME,
  defineCommand,
  orderAfterSibling,
  recomputeLocalKeepWorld,
  resolveEntityRef,
  resolveOptionalParent,
  subtreeIds,
  subtreeIdsRootFirst,
  uniqueSiblingName,
} from "./helpers.js";

function resolveAfter(
  ctx: ReadContext,
  after: Parameters<typeof resolveEntityRef>[1] | undefined,
): Result<string | undefined, TesseraError> {
  if (after === undefined) {
    return ok(undefined);
  }
  const resolved = resolveEntityRef(ctx.doc, after);
  if (!resolved.ok) {
    return resolved;
  }
  return ok(resolved.value.id);
}

export const entityCreate = defineCommand(entityCreateCommand, {
  validate(ctx, input) {
    const parent = resolveOptionalParent(ctx.doc, input.parent);
    if (!parent.ok) {
      return parent;
    }
    const after = resolveAfter(ctx, input.after);
    if (!after.ok) {
      return after;
    }
    if (after.value !== undefined) {
      const afterEntity = ctx.doc.getEntity(after.value);
      if (afterEntity !== undefined && afterEntity.parent !== parent.value) {
        return err(tesseraError("CONFLICT", "after is not a sibling of parent"));
      }
    }
    const parsed = ComponentsSchema.partial().safeParse(input.components ?? {});
    if (!parsed.success) {
      return err(
        tesseraError("INVALID_INPUT", "invalid components", { issues: parsed.error.issues }),
      );
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const parent = resolveOptionalParent(ctx.doc, input.parent);
    if (!parent.ok) {
      return parent;
    }
    const after = resolveAfter(ctx, input.after);
    if (!after.ok) {
      return after;
    }
    const siblings = ctx.doc.children(parent.value);
    const named = uniqueSiblingName(
      siblings,
      input.name ?? DEFAULT_ENTITY_NAME,
      input.strictName === true,
    );
    if (!named.ok) {
      return named;
    }
    const order = orderAfterSibling(siblings, after.value);
    if (!order.ok) {
      return order;
    }
    const transform = TransformSchema.parse(input.components?.transform ?? {});
    const components = ComponentsSchema.parse({ ...input.components, transform });
    const entity: Entity = {
      id: ctx.newId("e"),
      name: named.value,
      parent: parent.value,
      order: order.value,
      enabled: true,
      components,
    };
    const created = ctx.write.createEntity(entity);
    if (!created.ok) {
      return created;
    }
    return ok({ id: entity.id });
  },
});

export const entityDelete = defineCommand(entityDeleteCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const deleted = subtreeIds(ctx.doc, target.value.id);
    const deletedSet = new Set(deleted);
    const settings = ctx.doc.snapshot().settings;
    if (settings.mainCamera !== null && deletedSet.has(settings.mainCamera)) {
      const cleared = ctx.write.setSettings({ ...settings, mainCamera: null });
      if (!cleared.ok) {
        return cleared;
      }
    }
    for (const behavior of Object.values(ctx.doc.snapshot().behaviors)) {
      if (deletedSet.has(behavior.target)) {
        const detached = ctx.write.deleteBehavior(behavior.id);
        if (!detached.ok) {
          return detached;
        }
      }
    }
    for (const id of deleted) {
      const removed = ctx.write.removeEntityUnchecked(id);
      if (!removed.ok) {
        return removed;
      }
    }
    return ok({ deleted });
  },
});

export const entityDuplicate = defineCommand(entityDuplicateCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (input.parent !== undefined) {
      const parent = resolveEntityRef(ctx.doc, input.parent);
      if (!parent.ok) {
        return parent;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const count = input.count ?? 1;
    let parentId: string | null = target.value.parent;
    if (input.parent !== undefined) {
      const parent = resolveEntityRef(ctx.doc, input.parent);
      if (!parent.ok) {
        return parent;
      }
      parentId = parent.value.id;
    }
    const ids: string[] = [];
    const subtree = subtreeIdsRootFirst(ctx.doc, target.value.id);
    const offset = input.offset ?? ([0, 0, 0] as const);
    for (let copyIndex = 0; copyIndex < count; copyIndex += 1) {
      const idMap = new Map<string, string>();
      for (const oldId of subtree) {
        idMap.set(oldId, ctx.newId("e"));
      }
      const parentSiblings = ctx.doc.children(parentId ?? null);
      const named = uniqueSiblingName(parentSiblings, target.value.name, false);
      if (!named.ok) {
        return named;
      }
      const order = orderAfterSibling(parentSiblings, undefined);
      if (!order.ok) {
        return order;
      }
      for (const oldId of subtree) {
        const source = ctx.doc.getEntity(oldId);
        if (source === undefined) {
          return err(tesseraError("NOT_FOUND", "subtree entity missing", { id: oldId }));
        }
        const newId = idMap.get(oldId);
        if (newId === undefined) {
          return err(tesseraError("INVARIANT_VIOLATION", "missing mapped id", { id: oldId }));
        }
        const isRoot = oldId === target.value.id;
        const mappedParent = source.parent === null ? null : idMap.get(source.parent);
        const nextParent = isRoot ? (parentId ?? null) : (mappedParent ?? source.parent);
        const components = cloneComponents(source.components);
        if (isRoot && (offset[0] !== 0 || offset[1] !== 0 || offset[2] !== 0)) {
          const factor: [number, number, number] = [
            offset[0] * (copyIndex + 1),
            offset[1] * (copyIndex + 1),
            offset[2] * (copyIndex + 1),
          ];
          components.transform = {
            ...components.transform,
            position: addVec3(components.transform.position, factor),
          };
        }
        const entity: Entity = {
          id: newId,
          name: isRoot ? named.value : source.name,
          parent: nextParent,
          order: isRoot ? order.value : source.order,
          enabled: source.enabled,
          components,
        };
        const created = ctx.write.createEntity(entity);
        if (!created.ok) {
          return created;
        }
        if (isRoot) {
          ids.push(newId);
        }
      }
    }
    return ok({ ids });
  },
});

export const entityRename = defineCommand(entityRenameCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const siblings = ctx.doc.children(target.value.parent);
    const named = uniqueSiblingName(
      siblings,
      input.name,
      input.strictName === true,
      target.value.id,
    );
    if (!named.ok) {
      return named;
    }
    const updated = ctx.write.updateEntity({ ...target.value, name: named.value });
    if (!updated.ok) {
      return updated;
    }
    return ok({ name: named.value });
  },
});

export const entitySetParent = defineCommand(entitySetParentCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const parent = resolveOptionalParent(ctx.doc, input.parent);
    if (!parent.ok) {
      return parent;
    }
    if (input.after !== undefined) {
      const after = resolveEntityRef(ctx.doc, input.after);
      if (!after.ok) {
        return after;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const parentId = resolveOptionalParent(ctx.doc, input.parent);
    if (!parentId.ok) {
      return parentId;
    }
    const keepWorld = input.keepWorldTransform !== false;
    let newParent: Entity | null = null;
    if (parentId.value !== null) {
      const found = ctx.doc.getEntity(parentId.value);
      if (found === undefined) {
        return err(tesseraError("NOT_FOUND", "parent missing", { id: parentId.value }));
      }
      newParent = found;
    }
    let transform = target.value.components.transform;
    if (keepWorld) {
      const recomputed = recomputeLocalKeepWorld(target.value, newParent, ctx.doc);
      if (!recomputed.ok) {
        return recomputed;
      }
      transform = recomputed.value;
    }
    const afterId = input.after === undefined ? undefined : resolveEntityRef(ctx.doc, input.after);
    if (afterId !== undefined && !afterId.ok) {
      return afterId;
    }
    const siblings = ctx.doc.children(parentId.value);
    const order = orderAfterSibling(
      siblings,
      afterId === undefined ? undefined : afterId.value.id,
      target.value.id,
    );
    if (!order.ok) {
      return order;
    }
    const updated = ctx.write.updateEntity({
      ...target.value,
      parent: parentId.value,
      order: order.value,
      components: { ...target.value.components, transform },
    });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});

export const entityReorder = defineCommand(entityReorderCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    if (input.after !== undefined && input.after !== null) {
      const after = resolveEntityRef(ctx.doc, input.after);
      if (!after.ok) {
        return after;
      }
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const afterId =
      input.after === undefined || input.after === null
        ? input.after
        : resolveEntityRef(ctx.doc, input.after);
    if (afterId !== undefined && afterId !== null && typeof afterId !== "string" && !afterId.ok) {
      return afterId;
    }
    const resolvedAfter = afterId === undefined || afterId === null ? afterId : afterId.value.id;
    const siblings = ctx.doc.children(target.value.parent);
    const order = orderAfterSibling(siblings, resolvedAfter, target.value.id);
    if (!order.ok) {
      return order;
    }
    const updated = ctx.write.updateEntity({ ...target.value, order: order.value });
    if (!updated.ok) {
      return updated;
    }
    return ok({ order: order.value });
  },
});

export const entitySetEnabled = defineCommand(entitySetEnabledCommand, {
  validate(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    return ok(undefined);
  },
  handle(ctx, input) {
    const target = resolveEntityRef(ctx.doc, input.target);
    if (!target.ok) {
      return target;
    }
    const updated = ctx.write.updateEntity({ ...target.value, enabled: input.enabled });
    if (!updated.ok) {
      return updated;
    }
    return ok({});
  },
});
