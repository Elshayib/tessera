# 07 — Providers: language models and generation models

Status: Accepted · Last updated: 2026-09-06 · Packages: `@tessera/llm`, `@tessera/providers-llm`, `@tessera/generation`, `@tessera/providers-generation` · Phase: 2 (LLM), 3 (generation)

## 1. Purpose and scope

Model agnosticism is a structural property: the editor and the agent depend only on interfaces (`@tessera/llm`, `@tessera/generation`); vendor code lives in `providers-*` packages that the app wires at bootstrap (ADR-0007). This document specifies those interfaces, the capability probing protocol, the browser-to-provider network strategy, key storage, usage accounting, and the generation job model.

## 2. Language model interface (`@tessera/llm`)

```ts
export interface ModelRef { readonly providerId: string; readonly modelId: string; }

export interface ProviderDescriptor {
  readonly id: string;                              // 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'openrouter' | 'ollama' | 'openai-compatible' | plugin ids
  readonly displayName: string;
  readonly auth: 'apiKey' | 'none';
  readonly baseUrl: { readonly default?: string; readonly configurable: boolean };
  readonly browserDirect: 'yes' | 'header' | 'no'; // §5
  readonly listsModels: boolean;
  readonly docsUrl: string;
}

export interface ModelDescriptor {
  readonly ref: ModelRef;
  readonly displayName: string;
  readonly contextTokens?: number;
  readonly maxOutputTokens?: number;
  readonly pricing?: { readonly inputPerMTokUsd: number; readonly outputPerMTokUsd: number; readonly cachedInputPerMTokUsd?: number };
  readonly declared: Partial<Capabilities>;         // from vendor metadata; probing may override
}

export interface Capabilities {
  readonly tools: 'native' | 'json' | 'none';
  readonly parallelTools: boolean;
  readonly vision: boolean;
  readonly structuredOutput: boolean;               // JSON schema constrained output
  readonly streaming: boolean;
  readonly contextTokens: number;
  readonly maxTools: number;                        // practical limit before quality drops; default 64
  readonly needsExamples: boolean;                  // failed dry-run without few-shots
}

export type LlmMessage =
  | { readonly role: 'system'; readonly content: string }
  | { readonly role: 'user'; readonly parts: readonly (TextPart | ImagePart)[] }
  | { readonly role: 'assistant'; readonly parts: readonly (TextPart | ToolCallPart)[] }
  | { readonly role: 'tool'; readonly results: readonly ToolResultPart[] };
export interface TextPart { readonly kind: 'text'; readonly text: string }
export interface ImagePart { readonly kind: 'image'; readonly mime: 'image/jpeg' | 'image/png' | 'image/webp'; readonly data: Uint8Array }
export interface ToolCallPart { readonly kind: 'toolCall'; readonly callId: string; readonly name: string; readonly input: unknown }
export interface ToolResultPart { readonly callId: string; readonly name: string; readonly result: unknown; readonly isError: boolean }

export interface ToolSpec { readonly name: string; readonly description: string; readonly inputSchema: JsonSchema; }

export interface LlmRequest {
  readonly model: ModelRef;
  readonly messages: readonly LlmMessage[];
  readonly tools?: readonly ToolSpec[];
  readonly toolChoice?: 'auto' | 'none' | 'required' | { readonly name: string };
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly responseFormat?: { readonly kind: 'json_schema'; readonly schema: JsonSchema; readonly name: string };
  readonly metadata?: { readonly runId: string; readonly stepIndex: number };
}

export interface Usage { readonly inputTokens: number; readonly outputTokens: number; readonly cachedInputTokens?: number; readonly reasoningTokens?: number }

export interface LlmResponse {
  readonly message: Extract<LlmMessage, { role: 'assistant' }>;
  readonly usage: Usage;
  readonly finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'other';
  readonly modelId: string;                          // as reported by the provider
}

export type LlmStreamEvent =
  | { readonly type: 'text.delta'; readonly text: string }
  | { readonly type: 'tool.call'; readonly call: ToolCallPart }          // emitted when a complete call is available
  | { readonly type: 'done'; readonly response: LlmResponse };

export interface LlmClient {
  readonly provider: ProviderDescriptor;
  listModels(signal?: AbortSignal): Promise<Result<readonly ModelDescriptor[], TesseraError>>;
  generate(request: LlmRequest, signal?: AbortSignal): Promise<Result<LlmResponse, TesseraError>>;
  stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmStreamEvent>;   // ends with 'done' or throws-as-Err via a final event { type: 'done', response } — errors are yielded as a rejected iterator with TesseraError
  testConnection(signal?: AbortSignal): Promise<Result<{ latencyMs: number }, TesseraError>>;
}

export interface ProviderRegistry {
  register(factory: LlmClientFactory): void;        // (config: ProviderConfig) => LlmClient
  descriptors(): readonly ProviderDescriptor[];
  client(providerId: string): Result<LlmClient, TesseraError>;   // configured instance or NOT_FOUND / PERMISSION_DENIED (no key)
}

export interface ProviderConfig { readonly providerId: string; readonly baseUrl?: string; readonly apiKeyRef?: string; readonly headers?: Readonly<Record<string, string>>; readonly proxyUrl?: string }

export interface KeyVault {
  get(ref: string): Promise<Result<string, TesseraError>>;
  set(ref: string, secret: string): Promise<Result<void, TesseraError>>;
  delete(ref: string): Promise<Result<void, TesseraError>>;
  list(): Promise<Result<readonly { ref: string; createdAt: string }[], TesseraError>>;
  readonly locked: boolean;                         // when a passphrase is set and not yet entered
  unlock(passphrase: string): Promise<Result<void, TesseraError>>;
}
```

Error mapping (all providers): HTTP 401/403 → `PERMISSION_DENIED`; 404 model → `NOT_FOUND`; 429 → `RATE_LIMITED` (with `details.retryAfterMs`); 408/timeouts → `TIMEOUT`; 5xx and network → `PROVIDER_ERROR`; abort → `CANCELLED`; content filter → `PROVIDER_ERROR` with `details.reason = 'content_filter'`.

## 3. Capability probing

Probing runs once per `ModelRef` (cached 7 days in settings; re-run on demand) using ≤ 4 tiny requests:

| Probe | Request | Result |
| --- | --- | --- |
| Tools | One tool `echo({ value: string })`, prompt "Call echo with value 'ok'." | `tools = 'native'` if a tool call is returned; else try the JSON-mode instruction → `'json'`; else `'none'` |
| Parallel tools | Prompt asking for two echo calls | `parallelTools` |
| Vision | 64×64 image of a red square, "What color is the square? One word." | `vision = /red/i.test(answer)` |
| Structured output | `responseFormat` with a 2-field schema | `structuredOutput` |

`contextTokens` and `maxOutputTokens` come from the descriptor; unknown → conservative defaults (32k / 4k) with a UI warning. `needsExamples` is set when the first real run fails to produce any valid tool call and succeeds after few-shots are added (recorded per model).

## 4. AI SDK adapter (`@tessera/providers-llm`)

- One adapter module per provider kind, each exporting `createXxxClient(config, deps): LlmClient`. All share `src/internal/ai-sdk-bridge.ts` which maps `LlmRequest` ↔ AI SDK calls (`streamText`/`generateText` with `tools` built from `ToolSpec.inputSchema` via `jsonSchema()`), and maps AI SDK stream parts to `LlmStreamEvent`.
- The AI SDK version is pinned; the bridge is the only file allowed to change on SDK upgrades. Adapter tests run against recorded HTTP fixtures (`@tessera/testing` recorder) and never against live endpoints in CI.
- Provider specifics:
  - **OpenAI**: `@ai-sdk/openai`; Responses API; lists models.
  - **Anthropic**: `@ai-sdk/anthropic`; requires the direct-browser header (§5); lists models.
  - **Google**: `@ai-sdk/google`; lists models.
  - **xAI**, **DeepSeek**: official AI SDK providers where available, else `openai-compatible` with preset base URLs.
  - **OpenRouter**: `@openrouter/ai-sdk-provider`; lists models with pricing and context from its catalog (used to fill descriptors).
  - **Ollama**: `@ai-sdk/openai-compatible` at `http://localhost:11434/v1`; lists models via `/api/tags`; requires `OLLAMA_ORIGINS` for browser access (documented in settings UI).
  - **openai-compatible**: user-supplied base URL and optional key (LM Studio, vLLM, LiteLLM, llama.cpp server).
- Retries: idempotent requests retried up to 3 times with exponential backoff (500 ms base, jitter) on `RATE_LIMITED`/5xx/network; never on 4xx other than 429; the `AbortSignal` cancels immediately.

## 5. Browser-to-provider network strategy

| Provider | Direct from browser | Notes |
| --- | --- | --- |
| OpenAI | yes | CORS enabled |
| Google | yes | |
| OpenRouter | yes | |
| Ollama / local servers | yes when the server allows the origin | Settings show the exact env var / flag for the server |
| Anthropic | header | Requires `anthropic-dangerous-direct-browser-access: true`; the adapter sets it |
| Others without CORS | no | Route through `proxyUrl` |

`proxyUrl` options: (1) the desktop app's loopback proxy (`11 §5`) — automatic when running in Tauri; (2) a user-deployed CORS proxy (a Cloudflare Worker template is provided in `docs/templates/cors-proxy.worker.ts`) configured per provider. Tessera never hosts a proxy (ADR-0008). The service worker's CSP allowlist is regenerated from configured provider base URLs and proxy URLs.

## 6. Key storage

- Browser: keys in IndexedDB (`tessera-vault` database). When the user sets a passphrase, keys are encrypted with AES-GCM using a PBKDF2-derived key (600k iterations, per-vault salt); the vault is locked on reload until the passphrase is entered. Without a passphrase, keys are stored as-is with a visible warning ("anyone with access to this browser profile can read your keys").
- Desktop: OS keychain via Tauri plugin; the vault interface is identical.
- Keys never appear in documents, exports, logs, traces, change sets or crash reports (`redact()` masks anything matching configured secrets).

## 7. Usage accounting

`UsageLedger` (in `@tessera/agent`, persisted with transcripts): per run, per conversation and per project totals of tokens and estimated cost; the chat panel shows the current run's live counters; settings show monthly totals per provider. Budgets from `RunPolicy` are enforced from the ledger.

## 8. Generation interface (`@tessera/generation`)

```ts
export interface GenerationProviderDescriptor {
  readonly id: string;                              // 'meshy' | 'tripo' | 'rodin' | 'hf-trellis2' | 'local-worker' | plugin ids
  readonly displayName: string;
  readonly auth: 'apiKey' | 'none';
  readonly capabilities: { readonly textToMesh: boolean; readonly imageToMesh: boolean; readonly textToTexture: boolean; readonly meshToTexture: boolean; readonly textToImage: boolean; readonly textToEnvironment: boolean };
  readonly outputLicense: License | 'per-plan';     // what the provider's terms grant; 'per-plan' requires the user to pick in settings
  readonly typicalSeconds: { readonly mesh: number; readonly texture: number };
  readonly docsUrl: string;
}

export type GenerationRequest =
  | { readonly kind: 'mesh'; readonly prompt?: string; readonly images?: readonly BlobRef[]; readonly style?: 'realistic' | 'stylized' | 'lowpoly'; readonly targetTriangles?: number; readonly pbr: boolean; readonly seed?: number; readonly targetSizeMeters?: number }
  | { readonly kind: 'texture'; readonly prompt: string; readonly mesh?: BlobRef; readonly resolution: 1024 | 2048 | 4096; readonly maps: readonly ('baseColor' | 'normal' | 'roughness' | 'metallic' | 'occlusion')[] }
  | { readonly kind: 'environment'; readonly prompt: string; readonly resolution: 2048 | 4096 }
  | { readonly kind: 'image'; readonly prompt: string; readonly size: readonly [number, number]; readonly referenceImages?: readonly BlobRef[] };

export interface GenerationResult {
  readonly kind: GenerationRequest['kind'];
  readonly blobs: readonly BlobRef[];               // mesh: one GLB; texture: one image per map; environment: one HDR/EXR; image: one PNG
  readonly preview?: BlobRef;
  readonly license: License;
  readonly provenance: Provenance;                  // source 'generated', generator filled
  readonly stats?: { readonly triangles?: number; readonly seconds: number; readonly creditsUsed?: number };
}

export interface GenerationProvider {
  readonly descriptor: GenerationProviderDescriptor;
  estimate(request: GenerationRequest): Promise<Result<{ seconds: number; credits?: number; costUsd?: number }, TesseraError>>;
  submit(request: GenerationRequest, signal: AbortSignal): Promise<Result<{ remoteJobId: string }, TesseraError>>;
  poll(remoteJobId: string, signal: AbortSignal): Promise<Result<{ state: 'queued' | 'running' | 'succeeded' | 'failed'; progress?: number; message?: string }, TesseraError>>;
  fetchResult(remoteJobId: string, blobs: BlobStore, signal: AbortSignal): Promise<Result<GenerationResult, TesseraError>>;
  cancel?(remoteJobId: string): Promise<void>;
}
```

### 8.1 Job integration
`@tessera/assets` wraps a provider call in a `JobSpec` (kind `generate`): `submit` → poll with backoff (2 s → 10 s cap) → `fetchResult` → import pipeline (`08 §7`: normalize, bounds, optional decimation to `targetTriangles`, rescale to `targetSizeMeters` when given, otherwise size priors when the prompt names a known object) → `commit` creates assets (and optionally an entity at a requested position) through commands, with `provenance.generator` filled and the prompt hash recorded.

### 8.2 Built-in adapters (phase 3)
| Adapter | Transport | Notes |
| --- | --- | --- |
| Meshy | REST + API key | text-to-3D, image-to-3D, texture; credits; license per plan |
| Tripo | REST + API key | text/image-to-3D, auto-rig later |
| Rodin (Hyper3D) | REST + API key | high-detail meshes |
| Hugging Face Space (TRELLIS.2) | Gradio HTTP API + optional HF token | image-to-3D; text prompts go through an image provider first (two-stage job); free tier queues |
| Local worker | HTTP contract below | wraps any self-hosted model |

### 8.3 Local worker HTTP contract (public)
```
POST /v1/jobs            body: GenerationRequest (blobs as multipart or data URLs)   → 202 { id }
GET  /v1/jobs/{id}       → { state, progress, message }
GET  /v1/jobs/{id}/result→ multipart: result.json (GenerationResult minus blobs) + files
DELETE /v1/jobs/{id}     → 204
GET  /v1/capabilities    → GenerationProviderDescriptor
```
Auth: optional bearer token. A reference implementation wrapping TRELLIS.2 is provided as a Dockerfile in `bridges/generation-worker/` (phase 3, Python, permissive license).

## 9. Licensing and provenance rules

- Every generated asset gets `license` from the provider descriptor or the user's per-plan choice, and full `provenance.generator`.
- Providers whose terms restrict commercial use are marked in the UI; exports include `ATTRIBUTIONS.md` when any asset requires attribution (`08 §8`).
- Model licenses with regional restrictions (e.g., Hunyuan3D community license) are surfaced in the local worker's capabilities payload and shown before first use.

## 10. Invariants

| Id | Invariant |
| --- | --- |
| INV-PRV-01 | No package other than `providers-llm` imports the AI SDK; no package other than `providers-generation` imports a generation vendor SDK or hardcodes a vendor URL. |
| INV-PRV-02 | Keys are read from the vault at request time and never held in long-lived objects beyond the client instance's config reference. |
| INV-PRV-03 | Every provider error maps to a `TesseraError` code; raw vendor error bodies are logged at debug level only. |
| INV-PRV-04 | Capability profiles are probed, not assumed, for any model not in the curated descriptor list. |
| INV-PRV-05 | Generation results never enter the document without passing the import pipeline and receiving license + provenance. |

## 11. Test plan

- `@tessera/llm`: type tests, message builders, error mapping table.
- `providers-llm`: recorded-fixture tests per adapter (tool call round-trip, streaming, vision, structured output, rate-limit retry, abort); contract test suite `llm-client-contract.test.ts` run against every adapter with the recorder.
- Probing: deterministic tests with `FakeLlmClient` configured with each capability set.
- `providers-generation`: recorded fixtures per adapter; local worker contract tests against a fake worker server in-process.
- Live smoke tests (`TESSERA_LIVE=1`) per provider for maintainers.
