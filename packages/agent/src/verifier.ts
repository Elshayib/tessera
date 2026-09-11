import type { QueryRegistry, TransactionHandle } from "@tessera/core";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { SpatialCheckResult, Verdict } from "./run-types.js";
import type { RunPolicy } from "./tools/types.js";

/**
 * Injected verification (`06` §8). Body lands in T-0208.
 *
 * @public
 */
export interface Verifier {
  verify(input: {
    readonly policy: RunPolicy;
    readonly mutated: boolean;
    readonly queries: QueryRegistry;
    readonly tx: TransactionHandle;
  }): Promise<
    Result<
      { readonly spatial: SpatialCheckResult | null; readonly vision: Verdict | null },
      TesseraError
    >
  >;
}

/**
 * Skips verification when `policy.verify === 'none'` or nothing mutated.
 *
 * @example
 * ```ts
 * createSkipVerifier();
 * ```
 *
 * @public
 */
export function createSkipVerifier(): Verifier {
  return {
    async verify(input) {
      if (input.policy.verify === "none" || !input.mutated) {
        return ok({ spatial: null, vision: null });
      }
      return err(
        tesseraError(
          "UNSUPPORTED",
          "spatial verification is T-0208; inject a Verifier or set verify none",
        ),
      );
    },
  };
}
