import type { Author, CommandBus, DocumentReader } from "@tessera/core";
import { isOk } from "@tessera/std";

/**
 * Reparents `target` under `parent` (`entity.setParent`). One execute = one transaction.
 *
 * @public
 */
export function reparentEntity(
  bus: CommandBus,
  author: Author,
  target: string,
  parent: string | null,
): boolean {
  if (target === parent) {
    return false;
  }
  const result = bus.execute(
    "entity.setParent",
    { target, parent, keepWorldTransform: true },
    { author },
  );
  return isOk(result);
}

/**
 * Moves `target` one slot among siblings (`entity.reorder`).
 *
 * @public
 */
export function reorderEntity(
  bus: CommandBus,
  reader: DocumentReader,
  author: Author,
  target: string,
  direction: "up" | "down",
): boolean {
  const entity = reader.getEntity(target);
  if (entity === undefined) {
    return false;
  }
  const siblings = reader.children(entity.parent);
  let index = -1;
  for (let i = 0; i < siblings.length; i += 1) {
    if (siblings[i]?.id === target) {
      index = i;
      break;
    }
  }
  if (index < 0) {
    return false;
  }
  if (direction === "up") {
    if (index === 0) {
      return false;
    }
    const after = index === 1 ? null : (siblings[index - 2]?.id ?? null);
    const result = bus.execute("entity.reorder", { target, after }, { author });
    return isOk(result);
  }
  if (index >= siblings.length - 1) {
    return false;
  }
  const after = siblings[index + 1]?.id;
  if (after === undefined) {
    return false;
  }
  const result = bus.execute("entity.reorder", { target, after }, { author });
  return isOk(result);
}
