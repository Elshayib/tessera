import type { TesseraError } from "./error.js";
import { tesseraError } from "./error.js";

/**
 * {@link TesseraError} with code `CANCELLED`.
 *
 * @public
 */
export function abortError(): TesseraError {
  return tesseraError("CANCELLED", "Operation cancelled");
}

/**
 * Throws {@link abortError} when `signal` is already aborted.
 *
 * @example
 * ```ts
 * throwIfAborted(signal);
 * ```
 *
 * @public
 */
export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw abortError();
  }
}

/**
 * Returns a signal that aborts when any of `signals` abort.
 *
 * @example
 * ```ts
 * const signal = combineSignals(userSignal, timeoutSignal);
 * ```
 *
 * @public
 */
export function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const [first, ...rest] = signals;
  if (first === undefined) {
    return new AbortController().signal;
  }
  if (rest.length === 0) {
    return first;
  }
  return AbortSignal.any([first, ...rest]);
}
