import type { Author, CommandBus, TransactionOutcome } from "@tessera/core";
import type { Transform } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { ok } from "@tessera/std";

/**
 * Engine `transform.set` intent payload (`05` §12).
 *
 * @public
 */
export interface TransformSetIntent {
  readonly kind: "transform.set";
  readonly targets: readonly { readonly id: string; readonly transform: Transform }[];
  readonly label: string;
}

/**
 * Executes one `transform.set` per target in a single transaction (`INV-CMD-06`).
 *
 * @example
 * ```ts
 * applyTransformIntent(bus, author, { kind: "transform.set", label: "Move box", targets });
 * ```
 *
 * @public
 */
export function applyTransformIntent(
  bus: CommandBus,
  author: Author,
  intent: TransformSetIntent,
): Result<TransactionOutcome<undefined>, TesseraError> {
  return bus.transaction({ author, label: intent.label }, (tx) => {
    for (const target of intent.targets) {
      const result = tx.run("transform.set", {
        target: target.id,
        position: target.transform.position,
        rotation: target.transform.rotation,
        scale: target.transform.scale,
      });
      if (!result.ok) {
        return result;
      }
    }
    return ok(undefined);
  });
}
