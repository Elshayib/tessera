# `@tessera/providers-llm`

AI SDK adapters for `@tessera/llm`. This is the only package allowed to import `ai`, `@ai-sdk/*`, and `@openrouter/*` (`ADR-0007`, `INV-PRV-01`). Types from those packages live only in `src/internal/ai-sdk-bridge.ts`.

## Public API

| Export | Description |
| --- | --- |
| `createOpenAIClient` | OpenAI Responses API |
| `createAnthropicClient` | Anthropic; sets `anthropic-dangerous-direct-browser-access` |
| `createGoogleClient` | Google Gemini |
| `createXaiClient` | Official `@ai-sdk/xai`; `proxyUrl` required (`browserDirect: no`) |
| `createDeepSeekClient` | Official `@ai-sdk/deepseek`; `proxyUrl` required |
| `createOpenRouterClient` | OpenRouter catalog + chat |
| `createOllamaClient` | Default `http://localhost:11434/v1`; `listModels` via `/api/tags` |
| `createOpenAICompatibleClient` | User `baseUrl` required |
| `createIndexedDbKeyVault` | Browser IndexedDB vault (`tessera-vault`); optional AES-GCM + PBKDF2 |
| `LlmClientDeps` | `vault`, `Logger`, `Clock`; optional `fetch` / `sleep` / `languageModel`
| `withProviderRetries` | 3 attempts, 500 ms base, jitter from `Clock` |

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/llm`, `ai`, `@ai-sdk/*`, `@openrouter/ai-sdk-provider`. Must not import `@tessera/ui`, `@tessera/agent`, `@tessera/core`, `yjs`, React, or `three`.

## Usage example

```ts
import { createOpenAIClient } from "@tessera/providers-llm";

const client = createOpenAIClient({ providerId: "openai", apiKeyRef: "openai-key" }, deps);
```

## Testing notes

Colocated Vitest. HTTP list-model bodies live in `fixtures/`. Generate/stream map Tessera `role: "system"` messages to the AI SDK `system` option (Q-0162) and `role: "tool"` results to `tool-result` parts (Q-0163). Generate/stream use `languageModel` mocks (`ai/test`) so CI never hits live endpoints (Q-0116). Package coverage ≥ 85% lines (75% branches; Q-0134). Browser vault tests use `fake-indexeddb`. Desktop OS keychain is T-0505, not this package.

## Related specs

- `docs/07-providers.md` §4–§5
- Ticket T-0202
