import type { Clock } from "@tessera/std";
import { invariant } from "@tessera/std";

const DEFAULT_EPOCH_MS = 1_700_000_000_000;

/**
 * Controllable {@link Clock}. Time moves only through {@link FakeClock.advance}.
 *
 * @example
 * ```ts
 * const clock = new FakeClock();
 * clock.advance(1000);
 * ```
 *
 * @public
 */
export class FakeClock implements Clock {
  #nowMs: number;

  constructor(epochMs = DEFAULT_EPOCH_MS) {
    this.#nowMs = epochMs;
  }

  now(): number {
    return this.#nowMs;
  }

  nowIso(): string {
    return new Date(this.#nowMs).toISOString();
  }

  /**
   * Moves the clock forward by `ms` milliseconds.
   */
  advance(ms: number): void {
    invariant(
      Number.isFinite(ms) && ms >= 0,
      "FakeClock.advance requires a non-negative finite duration",
    );
    this.#nowMs += ms;
  }
}
