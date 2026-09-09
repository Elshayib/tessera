import type { ModelRef } from "@tessera/llm";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";
import type { ResolvedRoles, Role, RoleSources } from "./types.js";

function pick(
  role: Role,
  sources: Pick<RoleSources, "request" | "project" | "global">,
): ModelRef | undefined {
  return sources.request?.[role] ?? sources.project?.[role] ?? sources.global?.[role];
}

/**
 * Resolves planner / executor / critic (`06` §10, Q-0120).
 *
 * @example
 * ```ts
 * resolveRoles({ global: { executor: ref }, executorVision: false });
 * ```
 *
 * @public
 */
export function resolveRoles(sources: RoleSources): Result<ResolvedRoles, TesseraError> {
  const executor = pick("executor", sources);
  if (executor === undefined) {
    return err(tesseraError("INVALID_INPUT", "executor model is required"));
  }
  const planner = pick("planner", sources) ?? executor;
  const explicitCritic = pick("critic", sources);
  const critic = explicitCritic ?? (sources.executorVision ? executor : undefined);
  if (critic === undefined) {
    return ok({
      models: { planner, executor },
      criticEnabled: false,
    });
  }
  return ok({
    models: { planner, executor, critic },
    criticEnabled: true,
  });
}
