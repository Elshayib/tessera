import type { Capabilities, ModelRef } from "@tessera/llm";

/**
 * Probed model facts (`06` §2, `07` §3).
 *
 * @public
 */
export interface CapabilityProfile extends Capabilities {
  readonly ref: ModelRef;
  readonly maxOutputTokens: number;
}

/**
 * Agent roles (`06` §10).
 *
 * @public
 */
export type Role = "planner" | "executor" | "critic";

/**
 * Layered model selection (`06` §10).
 *
 * @public
 */
export interface RoleSources {
  readonly request?: Partial<Record<Role, ModelRef>>;
  readonly project?: Partial<Record<Role, ModelRef>>;
  readonly global?: Partial<Record<Role, ModelRef>>;
  readonly executorVision: boolean;
}

/**
 * Resolved role models. Critic is omitted when disabled (Q-0120).
 *
 * @public
 */
export interface ResolvedRoles {
  readonly models: {
    readonly planner: ModelRef;
    readonly executor: ModelRef;
    readonly critic?: ModelRef;
  };
  readonly criticEnabled: boolean;
}
