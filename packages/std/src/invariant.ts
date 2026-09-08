/**
 * Programmer-error thrown by {@link invariant}.
 *
 * @public
 */
export class InvariantError extends Error {
  readonly code = "INVARIANT_VIOLATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

/**
 * Throws {@link InvariantError} when `condition` is falsy.
 *
 * @example
 * ```ts
 * invariant(entity !== undefined, "entity must exist");
 * ```
 *
 * @public
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}
