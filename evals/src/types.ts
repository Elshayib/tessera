import type { RunPolicy, RunReport, RunTrace } from "@tessera/agent";
import type { Document } from "@tessera/schema";
import type { Assertion } from "@tessera/testing";

/**
 * Eval case (`13` §5.1).
 *
 * @public
 */
export interface EvalCase {
  readonly id: string;
  readonly title: string;
  readonly category:
    | "read"
    | "composition"
    | "layout"
    | "materials"
    | "lighting"
    | "cameras"
    | "assets"
    | "repair"
    | "destructive"
    | "multi-step"
    | "components";
  readonly difficulty: 1 | 2 | 3;
  readonly setup: (t: typeof import("@tessera/testing").docBuilder) => Document;
  readonly prompt: string;
  readonly attachments?: readonly string[];
  readonly assertions: (ctx: EvalContext) => readonly Assertion[];
  readonly rubric?: string;
  readonly policy?: Partial<RunPolicy>;
  readonly tags?: readonly string[];
}

/**
 * Screenshot placeholder (`13` §5.1). Bytes wait for engine capture (Q-0152).
 *
 * @public
 */
export interface Screenshot {
  readonly name: string;
}

/**
 * Per-case eval context (`13` §5.1).
 *
 * @public
 */
export interface EvalContext {
  readonly before: Document;
  readonly after: Document;
  readonly report: RunReport;
  readonly trace: RunTrace;
  readonly screenshots: readonly Screenshot[];
}
