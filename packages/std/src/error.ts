/**
 * Stable error codes for {@link TesseraError}.
 *
 * @public
 */
export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVARIANT_VIOLATION"
  | "PERMISSION_DENIED"
  | "UNSUPPORTED"
  | "CANCELLED"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "IO_ERROR"
  | "BUDGET_EXCEEDED"
  | "RATE_LIMITED";

/**
 * Handleable error returned in {@link Err}.
 *
 * @public
 */
export interface TesseraError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

/**
 * Builds a {@link TesseraError}. `message` must not contain secrets.
 *
 * @example
 * ```ts
 * tesseraError("NOT_FOUND", "entity missing", { id: "e_abc" });
 * ```
 *
 * @public
 */
export function tesseraError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): TesseraError {
  if (details === undefined) {
    return { code, message };
  }
  return { code, message, details };
}
