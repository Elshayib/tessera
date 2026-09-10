import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/** Spec text for blocked destructive tools (`06` §7.4). */
export const DESTRUCTIVE_CONFIRM_SUGGESTION =
  "Ask the user with ask_user, then retry after confirmation.";

/**
 * Whether a derived command is a destructive tool (`06` §7.4).
 *
 * `asset.delete` always clears or can force-clear references. `entity.delete` is
 * flagged only when callers pass `destructive: true` on the tool definition after
 * they know the subtree is large; this helper does not invent a headless count.
 *
 * @public
 */
export function isDestructiveCommand(name: string): boolean {
  return name === "asset.delete";
}

/**
 * Blocks destructive execution unless `confirmDestructive` is set (`INV-AGT-06`).
 *
 * @public
 */
export function denyIfDestructive(
  destructive: boolean,
  confirmDestructive: boolean,
): Result<void, TesseraError> {
  if (!destructive || confirmDestructive) {
    return ok(undefined);
  }
  return err(
    tesseraError("PERMISSION_DENIED", "Destructive tool requires confirmation.", {
      suggestion: DESTRUCTIVE_CONFIRM_SUGGESTION,
    }),
  );
}
