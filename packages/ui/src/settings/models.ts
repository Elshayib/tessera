import type { ModelRef } from "@tessera/llm";

/**
 * Roles that have a Settings model picker (`06` §10).
 *
 * @public
 */
export const ROLE_MODEL_KEYS = ["planner", "executor", "critic"] as const;

/**
 * Per-role {@link ModelRef} map.
 *
 * @public
 */
export type RoleModelMap = {
  readonly [K in (typeof ROLE_MODEL_KEYS)[number]]: ModelRef;
};

/**
 * Empty model refs until the user picks models.
 *
 * @public
 */
export function emptyRoleModels(): RoleModelMap {
  const blank: ModelRef = { providerId: "openai", modelId: "" };
  return { planner: blank, executor: blank, critic: blank };
}
