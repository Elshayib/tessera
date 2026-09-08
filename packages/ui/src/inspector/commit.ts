import type { Author, CommandBus } from "@tessera/core";
import { isOk } from "@tessera/std";

/**
 * Commits a component field. Transform uses `transform.set`; others `component.set`.
 *
 * @example
 * ```ts
 * commitInspectorPatch(bus, author, id, "camera", "fov", 40);
 * ```
 *
 * @public
 */
export function commitInspectorPatch(
  bus: CommandBus,
  author: Author,
  target: string,
  componentType: string,
  key: string,
  value: unknown,
): boolean {
  if (componentType === "transform") {
    const result = bus.execute("transform.set", { target, [key]: value }, { author });
    return isOk(result);
  }
  const result = bus.execute(
    "component.set",
    { target, type: componentType, patch: { [key]: value } },
    { author },
  );
  return isOk(result);
}
