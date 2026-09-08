import type { ErrorCode, TesseraError } from "@tessera/std";
import { en } from "./i18n/en.js";

/**
 * Maps a {@link TesseraError} to a catalog string. Never returns provider payloads (`01` §6).
 *
 * @example
 * ```ts
 * describeError({ code: "NOT_FOUND", message: "e_abc" });
 * ```
 *
 * @public
 */
export function describeError(error: TesseraError): {
  readonly key: string;
  readonly text: string;
} {
  return { key: errorMessageKey(error.code), text: en.errors[error.code] };
}

/**
 * i18n key for an {@link ErrorCode}.
 *
 * @public
 */
export function errorMessageKey(code: ErrorCode): string {
  return `errors.${code}`;
}
