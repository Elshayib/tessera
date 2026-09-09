import type { Clock } from "@tessera/std";
import { tesseraError } from "@tessera/std";
import type { UsageSummary } from "./run-types.js";
import type { RunPolicy } from "./tools/types.js";

/**
 * Run-wide budget tracker (`06` §12).
 *
 * @public
 */
export function createBudget(input: {
  readonly policy: RunPolicy;
  readonly clock: Clock;
  readonly startedAtMs: number;
  readonly signal?: AbortSignal;
}): {
  add(usage: { readonly inputTokens: number; readonly outputTokens: number }): void;
  snapshot(): UsageSummary;
  check():
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly cancelled: boolean;
        readonly error: ReturnType<typeof tesseraError>;
      };
} {
  let inputTokens = 0;
  let outputTokens = 0;
  return {
    add(usage) {
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
    },
    snapshot() {
      return { inputTokens, outputTokens };
    },
    check() {
      if (input.signal?.aborted === true) {
        return { ok: false, cancelled: true, error: tesseraError("CANCELLED", "run cancelled") };
      }
      const elapsed = input.clock.now() - input.startedAtMs;
      if (elapsed > input.policy.timeoutMs) {
        return {
          ok: false,
          cancelled: false,
          error: tesseraError("TIMEOUT", "run exceeded timeoutMs"),
        };
      }
      if (inputTokens > input.policy.maxInputTokens) {
        return {
          ok: false,
          cancelled: false,
          error: tesseraError("BUDGET_EXCEEDED", "maxInputTokens exceeded"),
        };
      }
      return { ok: true };
    },
  };
}
