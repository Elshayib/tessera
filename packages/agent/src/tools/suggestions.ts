import type { ErrorCode, Result, TesseraError } from "@tessera/std";
import { err, tesseraError } from "@tessera/std";
import type { ToolGroup } from "./types.js";

const TABLE: Readonly<Record<ToolGroup, Partial<Record<ErrorCode, string>>>> = {
  read: {
    NOT_FOUND: "Call scene.find with name 'oak*' to list candidates.",
    INVALID_INPUT: "Call scene.describe or scene.find with a path or id.",
  },
  entities: {
    NOT_FOUND: "Call scene.find with name 'oak*' to list candidates.",
    CONFLICT: "Call entity.get on the parent, then retry with a unique name.",
    INVALID_INPUT: "Pass an entity id (e_…) or { path }.",
  },
  components: {
    NOT_FOUND: "Call entity.get, then component.add for a missing type.",
    CONFLICT: "Call entity.get to see which components are already present.",
    INVALID_INPUT: "Pass a valid component type and patch.",
  },
  materials: {
    NOT_FOUND: "Call asset.list, then material.assign with an existing id.",
    CONFLICT: "Call asset.get to inspect the material before patching.",
    INVALID_INPUT: "Pass an asset id (a_…) for the material.",
  },
  assets: {
    NOT_FOUND: "Call asset.list to enumerate assets.",
    CONFLICT: "Pass force on asset.delete after ask_user, or pick an unreferenced asset.",
    INVALID_INPUT: "Pass an asset id (a_…).",
  },
  layout: {
    INVALID_INPUT: "Use layout macros with entity ids or { path } rather than guessed coordinates.",
    NOT_FOUND: "Call scene.find to resolve targets before a layout macro.",
  },
  camera: {
    NOT_FOUND: "Call scene.find for camera entities, then camera.setMain.",
    INVALID_INPUT: "Pass a camera entity id or { path }.",
  },
  environment: {
    INVALID_INPUT: "Patch only documented environment or settings fields.",
    CONFLICT: "Call settings via camera.setMain instead of changing units.",
  },
  generate: {
    UNSUPPORTED: "Generation tools are not enabled in this phase.",
  },
  code: {
    UNSUPPORTED: "Code and behavior tools are not enabled in this phase.",
  },
  meta: {
    INVALID_INPUT: "Call tools.catalog, then tools.enable with a listed group.",
    NOT_FOUND: "Call tools.catalog to list groups, then tools.enable.",
  },
};

/**
 * Suggestion for a failed tool call (`06` §7.2).
 *
 * @example
 * ```ts
 * suggestionFor("read", "NOT_FOUND");
 * ```
 *
 * @public
 */
export function suggestionFor(group: ToolGroup, code: ErrorCode): string | undefined {
  const row = TABLE[group];
  return row[code];
}

/**
 * Copies `suggestion` into `error.details` when the table has an entry.
 *
 * @public
 */
export function attachSuggestion<T>(
  group: ToolGroup,
  result: Result<T, TesseraError>,
): Result<T, TesseraError> {
  if (result.ok) {
    return result;
  }
  const existing = result.error.details;
  if (existing !== undefined && "suggestion" in existing) {
    return result;
  }
  const suggestion = suggestionFor(group, result.error.code);
  if (suggestion === undefined) {
    return result;
  }
  const details = existing === undefined ? { suggestion } : { ...existing, suggestion };
  return err(tesseraError(result.error.code, result.error.message, details));
}
