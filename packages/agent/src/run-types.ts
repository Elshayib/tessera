import type { ChangeSet, TransactionRecord } from "@tessera/core";
import type { ModelRef } from "@tessera/llm";
import type { TesseraError } from "@tessera/std";
import type { RunPolicy } from "./tools/types.js";
import type { CapabilityProfile, Role } from "./types.js";

/**
 * Viewport camera pose in run context (`06` §3, Q-0125).
 *
 * @public
 */
export interface ViewportCamera {
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
}

/**
 * One agent run (`06` §3).
 *
 * @public
 */
export interface RunRequest {
  readonly conversationId: string;
  readonly prompt: string;
  readonly context: {
    readonly selection: readonly string[];
    readonly viewportCamera?: ViewportCamera;
    readonly focusedEntity?: string;
  };
  readonly policy?: Partial<RunPolicy>;
  readonly models?: Partial<Record<Role, ModelRef>>;
}

/**
 * Token totals for a run (`06` §3).
 *
 * @public
 */
export interface UsageSummary {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Spatial check placeholder until T-0208.
 *
 * @public
 */
export interface SpatialCheckResult {
  readonly issues: readonly {
    readonly entity?: string;
    readonly path: string;
    readonly check: string;
    readonly severity: "error" | "warning" | "info";
    readonly message: string;
  }[];
}

/**
 * Vision critic verdict (`06` §8.2).
 *
 * @public
 */
export interface Verdict {
  readonly pass: boolean;
  readonly score: 1 | 2 | 3 | 4 | 5;
  readonly issues: readonly {
    readonly entity?: string;
    readonly problem: string;
    readonly suggestion: string;
  }[];
}

/**
 * End-of-run report (`06` §3).
 *
 * @public
 */
export interface RunReport {
  readonly summary: string;
  readonly transactions: readonly string[];
  readonly changeSet: ChangeSet;
  readonly verification: {
    readonly spatial: SpatialCheckResult | null;
    readonly vision: Verdict | null;
  };
  readonly remainingIssues: readonly string[];
  readonly suggestions: readonly string[];
}

/**
 * Streamed run events (`06` §3).
 *
 * @public
 */
export type RunEvent =
  | {
      readonly type: "run.started";
      readonly runId: string;
      readonly models: Record<Role, ModelRef>;
      readonly profile: CapabilityProfile;
    }
  | { readonly type: "step.started"; readonly stepIndex: number; readonly role: Role }
  | { readonly type: "model.delta"; readonly stepIndex: number; readonly text: string }
  | {
      readonly type: "plan.updated";
      readonly items: readonly { readonly text: string; readonly done: boolean }[];
    }
  | {
      readonly type: "tool.called";
      readonly stepIndex: number;
      readonly callId: string;
      readonly name: string;
      readonly input: unknown;
    }
  | {
      readonly type: "tool.result";
      readonly stepIndex: number;
      readonly callId: string;
      readonly ok: boolean;
      readonly summary: string;
      readonly durationMs: number;
    }
  | { readonly type: "transaction.committed"; readonly transaction: TransactionRecord }
  | { readonly type: "verify.started"; readonly round: number; readonly mode: "spatial" | "vision" }
  | { readonly type: "verify.result"; readonly round: number; readonly verdict: Verdict }
  | { readonly type: "run.completed"; readonly report: RunReport; readonly usage: UsageSummary }
  | { readonly type: "run.failed"; readonly error: TesseraError; readonly usage: UsageSummary }
  | { readonly type: "run.cancelled"; readonly usage: UsageSummary };
