import type { AgentRuntime } from "@tessera/agent/observability";
import type { CommandBus, JobQueue, QueryRegistry } from "@tessera/core";
import type { KeyVault, LlmClient, ModelRef, ProviderConfig } from "@tessera/llm";
import type { Clock, Logger, Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

/**
 * Inputs for {@link createWebAgentRuntime} (`02` §7).
 *
 * @public
 */
export interface CreateWebAgentRuntimeInput {
  readonly bus: CommandBus;
  readonly queries: QueryRegistry;
  readonly jobs: JobQueue;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly vault: KeyVault;
  readonly executor: ModelRef;
  readonly planner?: ModelRef;
  readonly critic?: ModelRef;
  readonly compatibleOrigin?: string;
  readonly llm?: LlmClient;
}

/**
 * Builds {@link AgentRuntime} for the editor chat panel.
 *
 * Uses an injected {@link LlmClient} in tests. Production loads
 * `@tessera/providers-llm` with a dynamic import so the empty editor graph
 * does not static-import `ai` (T-0203).
 *
 * @example
 * ```ts
 * const created = await createWebAgentRuntime({
 *   bus, queries, jobs, logger, clock, vault, executor,
 * });
 * ```
 *
 * @public
 */
export async function createWebAgentRuntime(
  input: CreateWebAgentRuntimeInput,
): Promise<Result<AgentRuntime, TesseraError>> {
  if (input.executor.modelId.length === 0) {
    return err(tesseraError("INVALID_INPUT", "executor model is required"));
  }
  const agent = await import("@tessera/agent");
  const planner =
    input.planner === undefined || input.planner.modelId.length === 0
      ? input.executor
      : input.planner;
  const critic =
    input.critic === undefined || input.critic.modelId.length === 0 ? undefined : input.critic;
  const roles = agent.resolveRoles({
    global: {
      executor: input.executor,
      planner,
      ...(critic === undefined ? {} : { critic }),
    },
    executorVision: false,
  });
  if (!roles.ok) {
    return roles;
  }
  let llm: LlmClient;
  if (input.llm !== undefined) {
    llm = input.llm;
  } else {
    const created = await clientFromVault(input);
    if (!created.ok) {
      return created;
    }
    llm = created.value;
  }
  const tools = agent.createToolRegistry();
  tools.deriveFromRegistries(input.bus.registry, input.queries);
  const runtime = agent.createAgentRuntime({
    bus: input.bus,
    queries: input.queries,
    jobs: input.jobs,
    tools,
    llm,
    roles: roles.value,
    profiles: {},
    logger: input.logger,
    clock: input.clock,
    verifier: agent.createSkipVerifier(),
  });
  return ok(runtime);
}

async function clientFromVault(
  input: CreateWebAgentRuntimeInput,
): Promise<Result<LlmClient, TesseraError>> {
  const providers = await import("@tessera/providers-llm");
  const providerId = input.executor.providerId;
  const origin = input.compatibleOrigin ?? "";
  const config: ProviderConfig = {
    providerId,
    apiKeyRef: providerId,
    ...(providerId === "openai-compatible" && origin.length > 0 ? { baseUrl: origin } : {}),
  };
  const deps = { vault: input.vault, logger: input.logger, clock: input.clock };
  if (providerId === "openai") {
    return ok(providers.createOpenAIClient(config, deps));
  }
  if (providerId === "anthropic") {
    return ok(providers.createAnthropicClient(config, deps));
  }
  if (providerId === "google") {
    return ok(providers.createGoogleClient(config, deps));
  }
  if (providerId === "xai") {
    return ok(providers.createXaiClient(config, deps));
  }
  if (providerId === "deepseek") {
    return ok(providers.createDeepSeekClient(config, deps));
  }
  if (providerId === "openrouter") {
    return ok(providers.createOpenRouterClient(config, deps));
  }
  if (providerId === "ollama") {
    return ok(providers.createOllamaClient(config, deps));
  }
  if (providerId === "openai-compatible") {
    return ok(providers.createOpenAICompatibleClient(config, deps));
  }
  return err(tesseraError("UNSUPPORTED", `unknown provider ${providerId}`));
}
