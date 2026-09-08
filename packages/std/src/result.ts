import type { TesseraError } from "./error.js";

/**
 * Successful {@link Result}.
 *
 * @public
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failed {@link Result}.
 *
 * @public
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Handleable success or failure. Layer 0–2 packages return this instead of throwing.
 *
 * @public
 */
export type Result<T, E extends TesseraError = TesseraError> = Ok<T> | Err<E>;

/**
 * Wraps `value` in an {@link Ok}.
 *
 * @example
 * ```ts
 * const result = ok(1);
 * ```
 *
 * @public
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Wraps `error` in an {@link Err}.
 *
 * @example
 * ```ts
 * const result = err(tesseraError("NOT_FOUND", "missing"));
 * ```
 *
 * @public
 */
export function err<E extends TesseraError>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Returns whether `result` is {@link Ok}.
 *
 * @public
 */
export function isOk<T, E extends TesseraError>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Returns whether `result` is {@link Err}.
 *
 * @public
 */
export function isErr<T, E extends TesseraError>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Maps the value of an {@link Ok}; leaves {@link Err} unchanged.
 *
 * @example
 * ```ts
 * map(ok(2), (n) => n * 2);
 * ```
 *
 * @public
 */
export function map<T, U, E extends TesseraError>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Flat-maps the value of an {@link Ok}; leaves {@link Err} unchanged.
 *
 * @example
 * ```ts
 * andThen(ok(2), (n) => ok(String(n)));
 * ```
 *
 * @public
 */
export function andThen<T, U, E extends TesseraError>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}
