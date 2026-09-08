import type { ChangeSet } from "./change-set.js";

const SUMMARY_MAX = 200;

/**
 * Fixed-template change-set summary. No model call (`docs/04-command-bus.md` §7).
 *
 * @example
 * ```ts
 * summarizeChangeSet({
 *   entities: { created: ["e_1"], deleted: [], updated: [] },
 *   assets: { created: [], deleted: [], updated: [] },
 *   behaviors: { created: [], deleted: [], updated: [] },
 *   summary: "",
 * });
 * ```
 *
 * @public
 */
export function summarizeChangeSet(changeSet: Omit<ChangeSet, "summary">): string {
  const parts: string[] = [];
  const created = changeSet.entities.created.length;
  if (created > 0) {
    parts.push(created === 1 ? "Created 1 entity" : `Created ${String(created)} entities`);
  }
  const deleted = changeSet.entities.deleted.length;
  if (deleted > 0) {
    parts.push(deleted === 1 ? "deleted 1 entity" : `deleted ${String(deleted)} entities`);
  }
  const moved = changeSet.entities.updated.filter((change) =>
    change.fields.some(
      (field) =>
        field.path === "parent" ||
        field.path === "components.transform.position" ||
        field.path.startsWith("components.transform.position"),
    ),
  );
  if (moved.length === 1) {
    const only = moved[0];
    if (only !== undefined) {
      parts.push(`moved ${only.id}`);
    }
  } else if (moved.length > 1) {
    parts.push(`moved ${String(moved.length)} entities`);
  }
  const otherUpdated = changeSet.entities.updated.length - moved.length;
  if (otherUpdated > 0) {
    parts.push(
      otherUpdated === 1 ? "updated 1 entity" : `updated ${String(otherUpdated)} entities`,
    );
  }
  const assetsCreated = changeSet.assets.created.length;
  if (assetsCreated > 0) {
    parts.push(assetsCreated === 1 ? "created 1 asset" : `created ${String(assetsCreated)} assets`);
  }
  const assetsDeleted = changeSet.assets.deleted.length;
  if (assetsDeleted > 0) {
    parts.push(assetsDeleted === 1 ? "deleted 1 asset" : `deleted ${String(assetsDeleted)} assets`);
  }
  const materials = changeSet.assets.updated.filter((change) =>
    change.fields.some((field) => field.path.startsWith("baseColor") || field.path === "name"),
  );
  if (materials.length === 1) {
    parts.push("changed material");
  } else if (changeSet.assets.updated.length > 0) {
    parts.push(
      changeSet.assets.updated.length === 1
        ? "updated 1 asset"
        : `updated ${String(changeSet.assets.updated.length)} assets`,
    );
  }
  if (changeSet.environment !== undefined && changeSet.environment.length > 0) {
    parts.push("changed environment");
  }
  if (changeSet.settings !== undefined && changeSet.settings.length > 0) {
    parts.push("changed settings");
  }
  const text = parts.length === 0 ? "No changes" : parts.join("; ");
  if (text.length <= SUMMARY_MAX) {
    return text;
  }
  return text.slice(0, SUMMARY_MAX);
}
