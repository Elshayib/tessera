import type { QueryRegistry, TransactionHandle } from "@tessera/core";
import type { LlmClient } from "@tessera/llm";
import type { CheckSceneReader } from "@tessera/spatial";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { SpatialCheckResult, Verdict } from "./run-types.js";
import type { RunPolicy } from "./tools/types.js";
import type { CapabilityProfile } from "./types.js";
import { captureVerificationScreenshots } from "./verify/screenshots.js";
import { runSpatialVerification } from "./verify/spatial.js";
import { reviewWithCritic } from "./verify/vision.js";

/**
 * Injected verification (`06` §8).
 *
 * @public
 */
export interface Verifier {
  verify(
    input: VerifyInput,
  ): Promise<
    Result<
      { readonly spatial: SpatialCheckResult | null; readonly vision: Verdict | null },
      TesseraError
    >
  >;
}

/**
 * Inputs for one verification round.
 *
 * @public
 */
export interface VerifyInput {
  readonly policy: RunPolicy;
  readonly mutated: boolean;
  readonly queries: QueryRegistry;
  readonly tx: TransactionHandle;
  readonly changedEntities?: readonly string[];
  readonly reader?: CheckSceneReader;
  readonly llm?: LlmClient;
  readonly critic?: { readonly profile: CapabilityProfile };
  readonly prompt?: string;
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
      return err(tesseraError("UNSUPPORTED", "inject createSceneVerifier or set verify none"));
    },
  };
}

/**
 * Spatial-then-vision verifier (`06` §8).
 *
 * @example
 * ```ts
 * createSceneVerifier();
 * ```
 *
 * @public
 */
export function createSceneVerifier(): Verifier {
  return {
    async verify(input) {
      if (input.policy.verify === "none" || !input.mutated) {
        return ok({ spatial: null, vision: null });
      }
      const reader = input.reader;
      const changed = input.changedEntities ?? [];
      if (reader === undefined) {
        return err(tesseraError("INVARIANT_VIOLATION", "verification needs a document reader"));
      }
      const spatial = runSpatialVerification(reader, changed);
      const wantVision = input.policy.verify === "spatial+vision";
      const critic = input.critic;
      if (!wantVision || critic === undefined || !critic.profile.vision) {
        return ok({ spatial, vision: null });
      }
      const shots = captureVerificationScreenshots(input.queries, changed);
      if (!shots.ok) {
        return ok({ spatial, vision: null });
      }
      const llm = input.llm;
      if (llm === undefined) {
        return err(tesseraError("UNSUPPORTED", "vision critic needs an LlmClient"));
      }
      const vision = await reviewWithCritic({
        llm,
        model: critic.profile.ref,
        structuredOutput: critic.profile.structuredOutput,
        prompt: input.prompt ?? "",
        spatial,
        screenshots: shots.value,
      });
      if (!vision.ok) {
        return err(vision.error);
      }
      return ok({ spatial, vision: vision.value });
    },
  };
}

/**
 * User message body for a failed verification round (`06` §8.2).
 *
 * @public
 */
export function verificationFeedbackMessage(
  spatial: SpatialCheckResult | null,
  vision: Verdict | null,
): string {
  const parts = [
    spatial === null ? "" : JSON.stringify(spatial.issues),
    vision === null ? "" : JSON.stringify(vision.issues),
  ].filter((part) => part.length > 0);
  return `Verification feedback: ${parts.join(" ")}`;
}

/**
 * True when spatial or vision reported problems.
 *
 * @public
 */
export function verificationHasIssues(
  spatial: SpatialCheckResult | null,
  vision: Verdict | null,
): boolean {
  if (spatial !== null && spatial.issues.length > 0) {
    return true;
  }
  if (vision !== null && (!vision.pass || vision.issues.length > 0)) {
    return true;
  }
  return false;
}
