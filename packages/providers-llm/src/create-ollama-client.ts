import type { LlmClient, ProviderConfig } from "@tessera/llm";
import { createAiSdkLlmClient } from "./internal/ai-sdk-bridge.js";
import type { LlmClientDeps } from "./llm-client-deps.js";

/**
 * Ollama adapter. Default base `http://localhost:11434/v1`; tags at `/api/tags`.
 *
 * @public
 */
export function createOllamaClient(config: ProviderConfig, deps: LlmClientDeps): LlmClient {
  return createAiSdkLlmClient("ollama", config, deps);
}
