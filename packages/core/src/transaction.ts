import type { TesseraError } from "@tessera/std";
import type { Author } from "./command-types.js";

/**
 * Thrown inside `ydoc.transact` so Yjs aborts the transaction (`INV-CMD-02`).
 *
 * @internal
 */
export class TransactionAbort {
  readonly error: TesseraError;

  constructor(error: TesseraError) {
    this.error = error;
  }
}

export function isTransactionAbort(value: unknown): value is TransactionAbort {
  return value instanceof TransactionAbort;
}

/**
 * Stable Yjs origin string for an author.
 *
 * @internal
 */
export function serializeAuthor(author: Author): string {
  if (author.runId === undefined) {
    return `${author.kind}:${author.id}`;
  }
  return `${author.kind}:${author.id}:run:${author.runId}`;
}
