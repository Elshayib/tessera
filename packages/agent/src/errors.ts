import type { ErrorCode, TesseraError } from "@tessera/std";
import { tesseraError } from "@tessera/std";

/**
 * Narrows thrown values to {@link TesseraError} (`06` §7.2).
 *
 * @public
 */
export function asTesseraError(value: unknown): TesseraError | undefined {
  if (typeof value !== "object" || value === null || !("code" in value) || !("message" in value)) {
    return undefined;
  }
  if (typeof value.code !== "string" || typeof value.message !== "string") {
    return undefined;
  }
  const code = parseErrorCode(value.code);
  if (code === undefined) {
    return tesseraError("PROVIDER_ERROR", value.message);
  }
  return tesseraError(code, value.message);
}

/**
 * Reads `TransactionAbort.error` without importing core internals (Q-0139).
 *
 * @public
 */
export function abortFrom(caught: unknown): TesseraError | undefined {
  if (typeof caught !== "object" || caught === null || !("error" in caught)) {
    return undefined;
  }
  return asTesseraError(caught.error);
}

function parseErrorCode(code: string): ErrorCode | undefined {
  switch (code) {
    case "INVALID_INPUT":
    case "NOT_FOUND":
    case "CONFLICT":
    case "INVARIANT_VIOLATION":
    case "PERMISSION_DENIED":
    case "UNSUPPORTED":
    case "CANCELLED":
    case "TIMEOUT":
    case "PROVIDER_ERROR":
    case "IO_ERROR":
    case "BUDGET_EXCEEDED":
    case "RATE_LIMITED":
      return code;
    default:
      return undefined;
  }
}
