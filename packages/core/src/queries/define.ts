import type { QuerySchema } from "@tessera/schema";
import type { Result, TesseraError } from "@tessera/std";
import { err, tesseraError } from "@tessera/std";
import type { QueryDefinition } from "./types.js";

/**
 * Attaches a handler to a catalog query schema.
 *
 * @internal
 */
export function defineQuery<I, O>(
  schema: QuerySchema<I, O>,
  handle: QueryDefinition<I, O>["handle"],
): QueryDefinition<I, O> {
  return { ...schema, handle };
}

export function invalidQueryInput(name: string, issues: unknown): Result<never, TesseraError> {
  return err(
    tesseraError("INVALID_INPUT", "invalid query input", {
      name,
      issues,
    }),
  );
}
