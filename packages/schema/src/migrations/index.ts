import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { Document } from "../document.js";
import { DocumentSchema } from "../document.js";

/**
 * Migrates a document snapshot to the current schema version.
 *
 * @public
 */
export function migrate(input: unknown): Result<Document, TesseraError> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return err(tesseraError("INVALID_INPUT", "document must be an object"));
  }
  const version = "version" in input ? input.version : undefined;
  if (version === "0.1.0") {
    const parsed = DocumentSchema.safeParse(input);
    if (!parsed.success) {
      return err(tesseraError("INVALID_INPUT", "document failed schema validation"));
    }
    return ok(parsed.data);
  }
  return err(
    tesseraError("UNSUPPORTED", "unknown document version", {
      version: typeof version === "string" ? version : "unknown",
    }),
  );
}
