/**
 * Injectable clock. Tests use a fake; production uses {@link systemClock}.
 *
 * @public
 */
export interface Clock {
  now(): number;
  nowIso(): string;
}

/**
 * Wall-clock {@link Clock} using `Date`.
 *
 * @public
 */
export const systemClock: Clock = {
  now() {
    return Date.now();
  },
  nowIso() {
    return new Date(Date.now()).toISOString();
  },
};
