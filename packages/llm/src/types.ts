import type { Result, TesseraError } from "@tessera/std";

/**
 * JSON Schema object as used by `07` §2 `ToolSpec` / `responseFormat` (Q-0114).
 *
 * @public
 */
export type JsonSchema = Readonly<Record<string, unknown>>;

/**
 * Provider + model identity (`07` §2).
 *
 * @public
 */
export interface ModelRef {
  readonly providerId: string;
  readonly modelId: string;
}

/**
 * Built-in and plugin provider metadata (`07` §2).
 *
 * @public
 */
export interface ProviderDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly auth: "apiKey" | "none";
  readonly baseUrl: { readonly default?: string; readonly configurable: boolean };
  readonly browserDirect: "yes" | "header" | "no";
  readonly listsModels: boolean;
  readonly docsUrl: string;
}

/**
 * Probed or declared model facts (`07` §2).
 *
 * @public
 */
export interface Capabilities {
  readonly tools: "native" | "json" | "none";
  readonly parallelTools: boolean;
  readonly vision: boolean;
  readonly structuredOutput: boolean;
  readonly streaming: boolean;
  readonly contextTokens: number;
  readonly maxTools: number;
  readonly needsExamples: boolean;
}

/**
 * Catalog row for a model (`07` §2). `declared` is not a complete profile (`INV-PRV-04`).
 *
 * @public
 */
export interface ModelDescriptor {
  readonly ref: ModelRef;
  readonly displayName: string;
  readonly contextTokens?: number;
  readonly maxOutputTokens?: number;
  readonly pricing?: {
    readonly inputPerMTokUsd: number;
    readonly outputPerMTokUsd: number;
    readonly cachedInputPerMTokUsd?: number;
  };
  readonly declared: Partial<Capabilities>;
}

/**
 * System / user / assistant / tool messages (`07` §2).
 *
 * @public
 */
export type LlmMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly parts: readonly (TextPart | ImagePart)[] }
  | { readonly role: "assistant"; readonly parts: readonly (TextPart | ToolCallPart)[] }
  | { readonly role: "tool"; readonly results: readonly ToolResultPart[] };

/**
 * Text content part (`07` §2).
 *
 * @public
 */
export interface TextPart {
  readonly kind: "text";
  readonly text: string;
}

/**
 * Image content part (`07` §2).
 *
 * @public
 */
export interface ImagePart {
  readonly kind: "image";
  readonly mime: "image/jpeg" | "image/png" | "image/webp";
  readonly data: Uint8Array;
}

/**
 * Tool-call part from an assistant (`07` §2).
 *
 * @public
 */
export interface ToolCallPart {
  readonly kind: "toolCall";
  readonly callId: string;
  readonly name: string;
  readonly input: unknown;
}

/**
 * Tool result returned to the model (`07` §2).
 *
 * @public
 */
export interface ToolResultPart {
  readonly callId: string;
  readonly name: string;
  readonly result: unknown;
  readonly isError: boolean;
}

/**
 * Tool JSON schema wrapper (`07` §2).
 *
 * @public
 */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

/**
 * One generation or stream request (`07` §2).
 *
 * @public
 */
export interface LlmRequest {
  readonly model: ModelRef;
  readonly messages: readonly LlmMessage[];
  readonly tools?: readonly ToolSpec[];
  readonly toolChoice?: "auto" | "none" | "required" | { readonly name: string };
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly responseFormat?: {
    readonly kind: "json_schema";
    readonly schema: JsonSchema;
    readonly name: string;
  };
  readonly metadata?: { readonly runId: string; readonly stepIndex: number };
}

/**
 * Token usage (`07` §2).
 *
 * @public
 */
export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
  readonly reasoningTokens?: number;
}

/**
 * Completed generation (`07` §2).
 *
 * @public
 */
export interface LlmResponse {
  readonly message: Extract<LlmMessage, { role: "assistant" }>;
  readonly usage: Usage;
  readonly finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "other";
  readonly modelId: string;
}

/**
 * Stream events; the iterator rejects with `TesseraError` (Q-0115).
 *
 * @public
 */
export type LlmStreamEvent =
  | { readonly type: "text.delta"; readonly text: string }
  | { readonly type: "tool.call"; readonly call: ToolCallPart }
  | { readonly type: "done"; readonly response: LlmResponse };

/**
 * Vendor-free LLM client (`07` §2).
 *
 * @public
 */
export interface LlmClient {
  readonly provider: ProviderDescriptor;
  listModels(signal?: AbortSignal): Promise<Result<readonly ModelDescriptor[], TesseraError>>;
  generate(request: LlmRequest, signal?: AbortSignal): Promise<Result<LlmResponse, TesseraError>>;
  stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmStreamEvent>;
  testConnection(signal?: AbortSignal): Promise<Result<{ latencyMs: number }, TesseraError>>;
}

/**
 * `(config) => LlmClient` as commented in `07` §2 (Q-0113).
 *
 * @public
 */
export type LlmClientFactory = (config: ProviderConfig) => LlmClient;

/**
 * Configured provider instances (`07` §2). Interface only in this package.
 *
 * @public
 */
export interface ProviderRegistry {
  register(factory: LlmClientFactory): void;
  descriptors(): readonly ProviderDescriptor[];
  client(providerId: string): Result<LlmClient, TesseraError>;
}

/**
 * Per-provider connection settings (`07` §2).
 *
 * @public
 */
export interface ProviderConfig {
  readonly providerId: string;
  readonly baseUrl?: string;
  readonly apiKeyRef?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly proxyUrl?: string;
}

/**
 * Secret storage (`07` §2). Implementation is T-0203.
 *
 * @public
 */
export interface KeyVault {
  get(ref: string): Promise<Result<string, TesseraError>>;
  set(ref: string, secret: string): Promise<Result<void, TesseraError>>;
  delete(ref: string): Promise<Result<void, TesseraError>>;
  list(): Promise<Result<readonly { ref: string; createdAt: string }[], TesseraError>>;
  readonly locked: boolean;
  unlock(passphrase: string): Promise<Result<void, TesseraError>>;
}
