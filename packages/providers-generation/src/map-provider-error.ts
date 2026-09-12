import type { TesseraError } from "@tessera/std";
import { tesseraError } from "@tessera/std";

/**
 * Normalized generation-provider failure (`INV-PRV-03`).
 *
 * @public
 */
export interface GenerationFailure {
  readonly kind: "http" | "timeout" | "abort" | "network" | "content_filter";
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly vendorBody?: string;
}

/**
 * Maps HTTP and transport failures to `TesseraError`. Vendor bodies are not copied.
 *
 * @example
 * ```ts
 * mapGenerationError({ kind: "http", status: 401 }).code;
 * ```
 *
 * @public
 */
export function mapGenerationError(failure: GenerationFailure): TesseraError {
  if (failure.kind === "abort") {
    return tesseraError("CANCELLED", "provider request cancelled");
  }
  if (failure.kind === "timeout") {
    return tesseraError("TIMEOUT", "provider request timed out");
  }
  if (failure.kind === "content_filter") {
    return tesseraError("PROVIDER_ERROR", "provider blocked the request", {
      reason: "content_filter",
    });
  }
  if (failure.kind === "network") {
    return tesseraError("PROVIDER_ERROR", "provider network error");
  }
  const status = failure.status;
  if (status === 401 || status === 403) {
    return tesseraError("PERMISSION_DENIED", "provider rejected credentials");
  }
  if (status === 404) {
    return tesseraError("NOT_FOUND", "generation job not found");
  }
  if (status === 429) {
    if (failure.retryAfterMs === undefined) {
      return tesseraError("RATE_LIMITED", "provider rate limited");
    }
    return tesseraError("RATE_LIMITED", "provider rate limited", {
      retryAfterMs: failure.retryAfterMs,
    });
  }
  if (status === 408) {
    return tesseraError("TIMEOUT", "provider request timed out");
  }
  return tesseraError("PROVIDER_ERROR", "provider request failed");
}
