import type { KeyVault } from "@tessera/llm";
import type { Clock, Logger } from "@tessera/std";

/**
 * Injected vault, logger, and clock for adapters (`07` §4, Q-0113).
 *
 * `languageModel` is a recorded-fixture stand-in for generate/stream (Q-0116).
 * Production callers omit it and use the AI SDK model for `kind`.
 *
 * @public
 */
export interface LlmClientDeps {
  readonly vault: KeyVault;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly fetch?: typeof fetch;
  readonly sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  readonly languageModel?: object;
}
