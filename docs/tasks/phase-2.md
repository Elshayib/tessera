# Phase 2 — Agent v1

Milestone: `m2-agent-v1` · Depends on T-0122
Tickets below were frozen by **T-0200**. Do not implement T-0201 until T-0200 is `done`.

| Id | Title | Package | Depends | Status |
| --- | --- | --- | --- | --- |
| T-0200 | Freeze phase-2 tickets | docs | T-0122 | `in-progress` |
| T-0201 | `@tessera/llm`: LlmClient, capabilities, KeyVault interface | llm | T-0200 | `in-progress` |
| T-0202 | `@tessera/providers-llm`: AI SDK providers + OpenAI-compatible + Ollama | providers-llm | T-0201 | `in-progress` ([#37](https://github.com/Elshayib/tessera/pull/37)) |
| T-0203 | Key vault: WebCrypto + IndexedDB; desktop keychain later | providers-llm / web | T-0202 | `in-progress` ([#39](https://github.com/Elshayib/tessera/pull/39)) |
| T-0204 | Capability probing + role assignment (planner/executor/critic) | agent | T-0202 | `in-progress` ([#40](https://github.com/Elshayib/tessera/pull/40)) |
| T-0205 | ToolRegistry derived from command/query catalogs + tiers 0–2 | agent | T-0204, T-0004 | `in-progress` ([#41](https://github.com/Elshayib/tessera/pull/41)) |
| T-0206 | `@tessera/spatial` macros: placeOn, snap, align, distribute, grid, lookAt, fit | spatial | T-0103 | `in-progress` ([#42](https://github.com/Elshayib/tessera/pull/42)) |
| T-0207 | AgentRuntime loop: observe → plan → act → verify → repair → report | agent | T-0205, T-0206 | `in-progress` ([#43](https://github.com/Elshayib/tessera/pull/43)) |
| T-0208 | Verification: spatial checks then screenshots (vision critic optional) | agent | T-0207, T-0107 | `in-progress` ([#44](https://github.com/Elshayib/tessera/pull/44)) |
| T-0209 | Review panel + revertRun; live apply (ADR-0016) | ui, agent | T-0207 | `in-progress` ([#45](https://github.com/Elshayib/tessera/pull/45)) |
| T-0210 | Chat panel, transcripts, traces (`15`) | ui, agent | T-0209 | `in-progress` ([#46](https://github.com/Elshayib/tessera/pull/46)) |
| T-0211 | Settings: BYOK providers, model picker, budgets | ui | T-0203 | `in-progress` ([#47](https://github.com/Elshayib/tessera/pull/47)) |
| T-0212 | `@tessera/testing` FakeLlmClient + Replay/Recording | testing | T-0201 | `todo` |
| T-0213 | `evals/` runner + core-20 cases (`13` §5.4) | evals | T-0207, T-0212 | `todo` |
| T-0214 | R3F code export | exporters | T-0111 | `todo` |
| T-0215 | Phase 2 exit: core-20 ≥ 90% replay, two providers | evals | T-0213 | `todo` |

## Specs

`06-agent-runtime.md`, `07-providers.md`, `13` §4–§5, ADR-0007, ADR-0016.

## Hard rules for implementers

- `agent` must not import `ai` or `@ai-sdk/*`.
- Every tool call goes through `CommandBus` with `author.kind = 'agent'`.
- No network in CI evals; replay fixtures only.

---

# T-0200 — Freeze phase-2 tickets (fill AC/Tests for T-0201+)

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `docs/tasks` |
| Size | M |
| Depends on | T-0122 |
| Status | `in-progress` |

## Goal

Every phase-2 implementation ticket T-0201–T-0215 has Goal, Context, Touches, acceptance criteria, Tests, and Non-goals at the same depth as phase-0 tickets, copied from specs (not invented).

## Context

- Spec: `docs/18-implementation-playbook.md` §4 (do not start a ticket that lacks AC)
- Template: `docs/templates/task-template.md`
- Index: `docs/tasks/README.md` (first ticket of a phase freezes later tickets)
- T-0122 work is on `main`; ticket files still say `in-progress` (Q-0025, Q-0112)

## Touches

```
docs/tasks/phase-2.md
scripts/check-phase-2-tickets.test.ts
docs/questions.md
```

## Acceptance criteria

1. T-0201 through T-0215 each have a `# T-0NNN —` heading plus Goal, Context, Touches, Acceptance criteria, Tests, Non-goals.
2. No T-0201–T-0215 ticket is a draft stub waiting to be expanded.
3. Touches and AC cite the linked spec sections; silent spots go in `docs/questions.md`.
4. A unit test fails if any of those sections is missing.

## Tests

| Test | File |
| --- | --- |
| `'T-0201–T-0215 have Goal, Context, Touches, AC, Tests, Non-goals'` | `scripts/check-phase-2-tickets.test.ts` |

## Non-goals

Implementing any package. Opening PRs for T-0201+. Git-tagging `m2-agent-v1`. Filling phase-3+ tickets. Marking phase-1 tickets `done`.

## Notes for the implementing agent

Phase-1 tickets remain `in-progress` until PR links exist (Q-0025). This freeze still proceeds so phase 2 has claimable tickets (Q-0112).

---

# T-0201 — `@tessera/llm`: LlmClient, capabilities, KeyVault interface

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/llm` |
| Size | M |
| Depends on | T-0200 |
| Status | `in-progress` |

## Goal

Layer-1 package `@tessera/llm` exists with the `07` §2 interfaces (`LlmClient`, `Capabilities`, `KeyVault`, `ProviderRegistry`, messages, tools, request/response/stream events) and no vendor SDK (`ADR-0007`, `INV-PRV-01`).

## Context

- Spec: `docs/07-providers.md` §2–§3, §10–§11
- Architecture: `docs/02-architecture.md` §4–§5 (`@tessera/llm` may import `std`, `schema` only)
- ADR: `docs/adr/ADR-0007-provider-interface-split.md`
- Playbook: `docs/18-implementation-playbook.md` §7
- `FakeLlmClient` is T-0212

## Touches

```
packages/llm/package.json
packages/llm/tsconfig.json
packages/llm/vitest.config.ts
packages/llm/README.md
packages/llm/src/index.ts
packages/llm/src/types.ts
packages/llm/src/types.test.ts
packages/llm/src/messages.ts
packages/llm/src/messages.test.ts
packages/llm/src/map-provider-error.ts
packages/llm/src/map-provider-error.test.ts
packages/llm/src/capabilities.ts
packages/llm/src/capabilities.test.ts
packages/llm/src/index.test.ts
tsconfig.json
knip.json
vitest.config.ts
docs/questions.md
```

## Acceptance criteria

1. Public types match `07` §2 as written: `ModelRef`, `ProviderDescriptor`, `ModelDescriptor`, `Capabilities`, `LlmMessage` and parts, `ToolSpec`, `LlmRequest`, `Usage`, `LlmResponse`, `LlmStreamEvent`, `LlmClient`, `ProviderRegistry`, `ProviderConfig`, `KeyVault`. Layer 0–2 returns `Result`. `AbortSignal` on `listModels` / `generate` / `stream` / `testConnection`.
2. `LlmClientFactory` is `(config: ProviderConfig) => LlmClient` as the `07` §2 comment. `ProviderRegistry` is an interface only (Q-0113).
3. `INV-PRV-01`: `@tessera/llm` does not depend on `ai`, `@ai-sdk/*`, or `@openrouter/*`. README states the layer-1 import rule.
4. `INV-PRV-03`: `mapProviderError` implements the `07` §2 table (401/403 → `PERMISSION_DENIED`; 404 model → `NOT_FOUND`; 429 → `RATE_LIMITED` with `details.retryAfterMs`; 408/timeouts → `TIMEOUT`; 5xx/network → `PROVIDER_ERROR`; abort → `CANCELLED`; content filter → `PROVIDER_ERROR` with `details.reason = 'content_filter'`). Mapped errors must not contain raw vendor bodies.
5. `INV-PRV-04`: `declared` on `ModelDescriptor` is `Partial<Capabilities>` and is not a complete profile. Unknown `contextTokens` / `maxOutputTokens` use named constants **32_000** / **4_000** (`07` §3). `Capabilities.maxTools` default **64** (`07` §2). No HTTP probing (T-0204).
6. `ToolSpec.inputSchema` / `responseFormat.schema` use a `JsonSchema` alias in this package (Q-0114). `KeyVault` is the interface only. `stream` errors reject the iterator with `TesseraError` (Q-0115).
7. New-package checklist (`18` §7): `exports` only `"."`. Root `tsconfig.json` reference. Coverage ≥ 85% (`01` §7). Changeset. TSDoc on public exports.

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-01 llm has no ai / @ai-sdk / @openrouter dependency'` | `packages/llm/src/types.test.ts` |
| `'INV-PRV-03 HTTP 401/403 → PERMISSION_DENIED'` | `packages/llm/src/map-provider-error.test.ts` |
| `'INV-PRV-03 HTTP 404 model → NOT_FOUND'` | `packages/llm/src/map-provider-error.test.ts` |
| `'INV-PRV-03 HTTP 429 → RATE_LIMITED with retryAfterMs'` | `packages/llm/src/map-provider-error.test.ts` |
| `'INV-PRV-03 timeout → TIMEOUT; abort → CANCELLED; 5xx/network → PROVIDER_ERROR'` | `packages/llm/src/map-provider-error.test.ts` |
| `'INV-PRV-03 content_filter → PROVIDER_ERROR reason content_filter'` | `packages/llm/src/map-provider-error.test.ts` |
| `'INV-PRV-04 declared Partial<Capabilities> is not a complete profile'` | `packages/llm/src/capabilities.test.ts` |
| `'unknown contextTokens/maxOutputTokens use 32k/4k defaults'` | `packages/llm/src/capabilities.test.ts` |
| `'maxTools default is 64'` | `packages/llm/src/capabilities.test.ts` |
| `'message builders produce LlmMessage parts from 07 §2'` | `packages/llm/src/messages.test.ts` |

## Non-goals

AI SDK adapters (T-0202). IndexedDB vault (T-0203). Capability HTTP probing (T-0204). `FakeLlmClient` (T-0212). `@tessera/generation`. Settings UI. Implementing a live `ProviderRegistry` store of configs.

## Notes for the implementing agent

Copy `07` §2 field names and literals. Do not import `@tessera/core`, `yjs`, React, or `three`.

Extra vs original Touches: omit `packages/llm` from the root Vitest 90% mix (Q-0133 follow-up); package config keeps 85% lines and 80% branches because V8 counts unreachable `??` null arms.

---

# T-0202 — `@tessera/providers-llm`: AI SDK providers + OpenAI-compatible + Ollama

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/providers-llm` |
| Size | L |
| Depends on | T-0201 |
| Status | `in-progress` |

## Goal

Layer-2 `@tessera/providers-llm` implements `LlmClient` via the AI SDK for OpenAI, Anthropic, Google, xAI, DeepSeek, OpenRouter, Ollama, and generic OpenAI-compatible (`07` §4–§5), with one bridge file owning AI SDK types (`ADR-0007`).

## Context

- Spec: `docs/07-providers.md` §4–§5, error mapping `07` §2, retries `07` §4
- Architecture: `docs/02-architecture.md` §4–§5 (`ai` / `@ai-sdk/*` / `@openrouter/*` only here)
- ADR: ADR-0007 (`providers-llm/src/internal/ai-sdk-bridge.ts` is the only AI SDK type file)
- Security: `docs/14-security-threat-model.md` SEC-02, SEC-04
- Shared recorder is T-0212; this ticket may commit package-local HTTP fixtures (Q-0116)
- Desktop loopback proxy is T-0505

## Touches

```
packages/providers-llm/package.json
packages/providers-llm/tsconfig.json
packages/providers-llm/vitest.config.ts
packages/providers-llm/README.md
packages/providers-llm/src/index.ts
packages/providers-llm/src/internal/ai-sdk-bridge.ts
packages/providers-llm/src/internal/ai-sdk-bridge.test.ts
packages/providers-llm/src/retries.ts
packages/providers-llm/src/retries.test.ts
packages/providers-llm/src/create-openai-client.ts
packages/providers-llm/src/create-anthropic-client.ts
packages/providers-llm/src/create-google-client.ts
packages/providers-llm/src/create-xai-client.ts
packages/providers-llm/src/create-deepseek-client.ts
packages/providers-llm/src/create-openrouter-client.ts
packages/providers-llm/src/create-ollama-client.ts
packages/providers-llm/src/create-openai-compatible-client.ts
packages/providers-llm/src/llm-client-contract.test.ts
packages/providers-llm/src/*.test.ts
packages/providers-llm/fixtures/
tsconfig.json
knip.json
docs/questions.md
pnpm-lock.yaml
```

## Acceptance criteria

1. Each kind in `07` §4 exports `createXxxClient(config, deps): LlmClient`. `ProviderDescriptor.id` values are `'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'openrouter' | 'ollama' | 'openai-compatible'`.
2. `INV-PRV-01`: only this package imports `ai` / `@ai-sdk/*` / `@openrouter/*`. Only `src/internal/ai-sdk-bridge.ts` imports AI SDK types. Adapter tests never hit live endpoints in CI.
3. Bridge maps `LlmRequest` ↔ `generateText` / `streamText`, tools from `ToolSpec.inputSchema` via `jsonSchema()`, stream parts → `LlmStreamEvent` (`text.delta`, `tool.call` when complete, `done`).
4. Provider specifics (`07` §4–§5): OpenAI Responses API + `listModels`; Anthropic sets `anthropic-dangerous-direct-browser-access: true`; Google lists models; OpenRouter catalog fills pricing/context; Ollama default `http://localhost:11434/v1` and `listModels` via `/api/tags`; `openai-compatible` uses user `baseUrl`. xAI / DeepSeek: official AI SDK provider if present at the pinned version, else openai-compatible **without hardcoded vendor URLs** (Q-0117).
5. `browserDirect`: OpenAI / Google / OpenRouter / Ollama `'yes'`; Anthropic `'header'`; others without CORS `'no'` and require `proxyUrl`. Do not add the missing Cloudflare Worker file or Tauri proxy.
6. Retries (`07` §4): up to 3 attempts, 500 ms base + jitter, only on `RATE_LIMITED` / 5xx / network; `AbortSignal` cancels immediately. Inject `Clock`.
7. `INV-PRV-02`: clients hold `apiKeyRef`, not the secret. `KeyVault.get` at request time. Missing key → `PERMISSION_DENIED`.
8. `INV-PRV-03`: vendor failures go through `mapProviderError`. `TesseraError` and `info+` logs must not contain vendor bodies or secrets.
9. Contract suite `llm-client-contract.test.ts` (`07` §11) covers tool-call, streaming, vision, structured output, rate-limit retry, abort — against recorded fixtures. Coverage ≥ 85%. Changeset. Pin AI SDK versions in the PR **New dependencies** section.
10. Split the PR if it exceeds ~600 loc excluding tests/fixtures and record the split in this file.

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-01 only ai-sdk-bridge imports ai / @ai-sdk / @openrouter'` | `packages/providers-llm/src/internal/ai-sdk-bridge.test.ts` |
| `'INV-PRV-02 generate calls KeyVault.get at request time'` | `packages/providers-llm/src/llm-client-contract.test.ts` |
| `'INV-PRV-03 429 maps to RATE_LIMITED and retries'` | `packages/providers-llm/src/retries.test.ts` |
| `'INV-PRV-03 raw vendor body is not on TesseraError'` | `packages/providers-llm/src/llm-client-contract.test.ts` |
| `'contract: tool call round-trip'` | `packages/providers-llm/src/llm-client-contract.test.ts` |
| `'contract: streaming ends with done'` | `packages/providers-llm/src/llm-client-contract.test.ts` |
| `'contract: abort → CANCELLED'` | `packages/providers-llm/src/llm-client-contract.test.ts` |
| `'Anthropic sets anthropic-dangerous-direct-browser-access'` | `packages/providers-llm/src/create-anthropic-client.test.ts` |
| `'Ollama listModels uses /api/tags and default 11434/v1'` | `packages/providers-llm/src/create-ollama-client.test.ts` |
| `'retries: 3 attempts, 500ms base; no retry on 401'` | `packages/providers-llm/src/retries.test.ts` |

## Non-goals

IndexedDB vault (T-0203). Capability probing (T-0204). `FakeLlmClient` in `@tessera/testing` (T-0212). Settings UI (T-0211). CSP allowlist regeneration. `TESSERA_LIVE=1` in CI. Generation providers. Wiring `EditorContext.agent`.

## Notes for the implementing agent

`deps` (vault, `Logger`, `Clock`) are required by invariants; define `LlmClientDeps` in this package rather than widening `@tessera/llm`’s factory (Q-0113). Do not import `@tessera/ui` or `@tessera/agent`.

---

# T-0203 — Key vault: WebCrypto + IndexedDB; desktop keychain later

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/providers-llm` / `apps/web` |
| Size | M |
| Depends on | T-0202 |
| Status | `in-progress` |

## Goal

Browser `KeyVault` (`07` §6): IndexedDB database `tessera-vault`; optional AES-GCM with PBKDF2 (600k iterations, per-vault salt); locked after reload until `unlock`. Desktop OS keychain is T-0505.

## Context

- Spec: `docs/07-providers.md` §2 `KeyVault`, §6, `INV-PRV-02`
- Security: `docs/14-security-threat-model.md` SEC-03, SEC-04
- Architecture: `docs/02-architecture.md` §4 (providers-llm owns vault implementations), §7 `EditorContext` has no `keyVault` field (Q-0118)
- `providers-llm` may not import `@tessera/storage` (`02` §4)

## Touches

```
packages/providers-llm/src/indexeddb-key-vault.ts
packages/providers-llm/src/indexeddb-key-vault.test.ts
packages/providers-llm/src/index.ts
packages/providers-llm/README.md
apps/web/package.json
apps/web/src/bootstrap.ts
apps/web/src/bootstrap.test.ts
docs/questions.md
```

## Acceptance criteria

1. `createIndexedDbKeyVault` implements `KeyVault`: `get` / `set` / `delete` / `list` / `locked` / `unlock`. Database name **`tessera-vault`**. Methods return `Promise<Result<…>>`.
2. With a passphrase: AES-GCM; PBKDF2 **600_000** iterations; per-vault salt. After reload, `locked === true` until `unlock`; `get`/`set` while locked → `PERMISSION_DENIED`. Named constants: PBKDF2-SHA-256, 16-byte salt, 12-byte IV, AES-256-GCM (Q-0119).
3. Without a passphrase: store secrets as-is. Visible warning copy is T-0211. Do not add `setPassphrase` / `lock` to the `07` §2 interface.
4. `INV-PRV-02`: secrets are returned only from `get`. Canary secret must not appear in `redact(logger output)` or `TesseraError` (`INV-SEC-02`).
5. Do not add `keyVault` to `EditorContext` (`02` §7, Q-0118). Do not static-import the providers-llm barrel from bootstrap if that pulls `ai` into the empty-editor graph.
6. Tests use `fake-indexeddb` and injected `Clock`. Changeset. README: browser vault vs desktop keychain later.

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-02 get reads the secret at call time from tessera-vault'` | `packages/providers-llm/src/indexeddb-key-vault.test.ts` |
| `'set/get/delete/list round-trip without passphrase'` | `packages/providers-llm/src/indexeddb-key-vault.test.ts` |
| `'passphrase: AES-GCM; locked after reopen until unlock'` | `packages/providers-llm/src/indexeddb-key-vault.test.ts` |
| `'get while locked is PERMISSION_DENIED'` | `packages/providers-llm/src/indexeddb-key-vault.test.ts` |
| `'PBKDF2 iteration count is 600000'` | `packages/providers-llm/src/indexeddb-key-vault.test.ts` |
| `'INV-SEC-02 canary secret absent from redact(logs) and TesseraError'` | `packages/providers-llm/src/indexeddb-key-vault.test.ts` |
| `'bootstrap still builds EditorContext without KeyVault field'` | `apps/web/src/bootstrap.test.ts` |

## Non-goals

OS keychain (T-0505). Settings BYOK UI (T-0211). Changing `02` §7. Syncing vault over collab.

## Notes for the implementing agent

Passphrase enters via factory options. Do not auto-migrate plaintext vaults to encrypted. No `if (tauri)` branches.

---

# T-0204 — Capability probing + role assignment (planner/executor/critic)

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/agent` |
| Size | M |
| Depends on | T-0202 |
| Status | `in-progress` |

## Goal

`@tessera/agent` exists. For a `ModelRef`, probing (`07` §3) produces a `CapabilityProfile`. Roles `planner` / `executor` / `critic` resolve to models per `06` §10. The package imports `@tessera/llm` only — never `ai` or `@ai-sdk/*` (`INV-AGT-02`, `INV-PRV-01`).

## Context

- Spec: `docs/06-agent-runtime.md` §2, §10–§11 · `docs/07-providers.md` §3, `INV-PRV-04`
- Architecture: `docs/02-architecture.md` §4 `@tessera/agent`
- ADR-0007 vendor isolation
- `FakeLlmClient` in `@tessera/testing` is T-0212; this ticket may use a local `LlmClient` test double

## Touches

```
packages/agent/package.json
packages/agent/tsconfig.json
packages/agent/README.md
packages/agent/src/index.ts
packages/agent/src/types.ts
packages/agent/src/probe.ts
packages/agent/src/probe.test.ts
packages/agent/src/roles.ts
packages/agent/src/roles.test.ts
packages/agent/src/probe-cache.ts
packages/agent/src/probe-cache.test.ts
tsconfig.json
knip.json
docs/questions.md
```

## Acceptance criteria

1. Probe uses **at most 4** tiny `LlmClient` requests, in `07` §3 order: tools (`echo({ value: string })`, “Call echo with value 'ok'.”) → parallel tools → vision (64×64 red square) → structured output (2-field schema).
2. Tools: `'native'` if a tool call is returned; else JSON-mode instruction → `'json'`; else `'none'`. Vision is `/red/i` on the answer.
3. `contextTokens` / `maxOutputTokens` from `ModelDescriptor`; unknown → 32k / 4k. `maxTools` default 64 when undeclared. `needsExamples` is **false** after probing (set later from a failed real run, T-0207).
4. Cache TTL **7 days** (`07` §3). `INV-PRV-04`: models not on a curated list are still probed.
5. Role order: `request.models` → project settings → global (`06` §10). Planner defaults to executor. Critic = executor if `vision`, else critic disabled. Do not invent a sentinel model id for “none” (Q-0120).
6. No import of `ai`, `@ai-sdk/*`, `three`, or `@tessera/providers-llm`. Coverage ≥ 85% (`01` §7). README lists every export. Changeset.

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-04 unknown model is probed not assumed'` | `packages/agent/src/probe.test.ts` |
| `'INV-AGT-02 probe uses LlmClient only'` | `packages/agent/src/probe.test.ts` |
| `'tools native vs json vs none'` | `packages/agent/src/probe.test.ts` |
| `'parallelTools vision structuredOutput'` | `packages/agent/src/probe.test.ts` |
| `'unknown descriptor uses 32k/4k'` | `packages/agent/src/probe.test.ts` |
| `'probe cache ttl 7 days'` | `packages/agent/src/probe-cache.test.ts` |
| `'roles request overrides project overrides global'` | `packages/agent/src/roles.test.ts` |
| `'critic disabled when executor has no vision'` | `packages/agent/src/roles.test.ts` |

## Non-goals

`AgentRuntime` loop (T-0207). `ToolRegistry` (T-0205). Settings UI. JSON-mode execution protocol. Spatial macros (T-0206).

## Notes for the implementing agent

Tests must not hit the network. Inject `Clock` / `FakeClock`.

---

# T-0205 — ToolRegistry derived from command/query catalogs + tiers 0–2

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/agent` |
| Size | L |
| Depends on | T-0204, T-0004 |
| Status | `in-progress` |

## Goal

`ToolRegistry` (`06` §3) lists tools derived from `CommandRegistry` and `QueryRegistry` for **tiers 0–2**. Command tools execute via `ctx.tx.run(name, input)` with `author.kind = 'agent'`. Query tools never open a transaction (`INV-AGT-05`).

## Context

- Spec: `docs/06-agent-runtime.md` §3, §5, §7.2–§7.4 · `docs/04-command-bus.md` §8, §10
- Catalog today: `packages/schema/src/catalog.ts` (`COMMAND_CATALOG` §8.1–8.4). Macros land in T-0206 and appear when registered.
- `asset.import` is tier 3 (`04` §8.3) — omit from this ticket

## Touches

```
packages/agent/src/tools/registry.ts
packages/agent/src/tools/registry.test.ts
packages/agent/src/tools/derive.ts
packages/agent/src/tools/derive.test.ts
packages/agent/src/tools/select.ts
packages/agent/src/tools/select.test.ts
packages/agent/src/tools/meta.ts
packages/agent/src/tools/meta.test.ts
packages/agent/src/tools/destructive.ts
packages/agent/src/tools/destructive.test.ts
packages/agent/src/tools/suggestions.ts
packages/agent/src/tools/suggestions.test.ts
packages/agent/src/index.ts
packages/agent/README.md
docs/questions.md
```

## Acceptance criteria

1. `deriveFromRegistries` creates one tool per command/query with the **same `name`**. Description ≤ 400 chars, imperative, plus input hints. Input/output Zod schemas are the catalog schemas (`INV-AGT-03`).
2. Command tools: `execute` = `ctx.tx.run`. Query tools: `tier: 0`, `ctx.queries` only — never `tx.run`.
3. Skip tier ≥ 3 even if present. No `asset.search`, `asset.generate*`, `jobs.await`, `script.run`, `procedural.define`, `behavior.attach`.
4. Meta-tools: `plan.set({ items })`, `tools.catalog`, `tools.enable({ group })`, `ask_user`. Groups are the `06` §3 union only.
5. `destructive: true` for delete ≥ 20 entities, asset delete, or force-clear references. When `confirmDestructive === false`, return `PERMISSION_DENIED` with `suggestion: "Ask the user with ask_user, then retry after confirmation."` (`INV-AGT-06`).
6. Tool errors as results, never thrown (`06` §7.2). `suggestion` from a fixed table keyed by `(tool group, error code)`.
7. `selectTools`: always tier 0 + meta. If `profile.maxTools ≥ 40`, include all enabled 0–2. Else catalog mode: tier 0 + groups `entities`, `components`, `layout`.
8. `history.undoLast` is named in `06` §7.1 but absent from `04` §8 — do not invent a command (Q-0121). Coverage ≥ 85%. README updated.

## Tests

| Test | File |
| --- | --- |
| `'INV-AGT-03 tool input uses command Zod schema'` | `packages/agent/src/tools/derive.test.ts` |
| `'INV-CMD-10 derived names match registries'` | `packages/agent/src/tools/derive.test.ts` |
| `'INV-AGT-05 query tools do not open a transaction'` | `packages/agent/src/tools/derive.test.ts` |
| `'INV-AGT-06 destructive blocked without confirmDestructive'` | `packages/agent/src/tools/destructive.test.ts` |
| `'tiers 0-2 only; tier 3 commands omitted'` | `packages/agent/src/tools/derive.test.ts` |
| `'selectTools catalog mode when maxTools < 40'` | `packages/agent/src/tools/select.test.ts` |
| `'meta plan.set tools.catalog tools.enable ask_user'` | `packages/agent/src/tools/meta.test.ts` |
| `'error suggestion table by group and code'` | `packages/agent/src/tools/suggestions.test.ts` |

## Non-goals

Run loop (T-0207). Spatial macros (T-0206). Generation tools. MCP. Adding commands to `COMMAND_CATALOG`.

## Notes for the implementing agent

Mutating `execute` must not call `Y.Map.set`. Layout macros derive only after T-0206 registers them.

---

# T-0206 — `@tessera/spatial` macros: `layout.*` + `camera.fit`

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/spatial` (schemas `@tessera/schema`, handlers `@tessera/core`) |
| Size | L |
| Depends on | T-0103 |
| Status | `in-progress` ([#42](https://github.com/Elshayib/tessera/pull/42)) |

## Goal

Every macro in `04` §8.5 is a tier-2 catalog command: deterministic layout math in `@tessera/spatial`, Zod schemas in `@tessera/schema`, handlers in `@tessera/core` that expand to primitive commands in **one** transaction via `ctx.run` (`INV-CMD-08`).

## Context

- Spec: `docs/04-command-bus.md` §8.5 (full table), `INV-CMD-08`
- Architecture: `docs/02-architecture.md` §4; spatial does not import `@tessera/core` (Q-0037)
- Ticket title omitted `layout.scatter` and `layout.resolveOverlaps` — spec wins (Q-0132)
- `checkScene` is T-0208, not this ticket

## Touches

```
packages/spatial/src/**
packages/spatial/src/*.test.ts
packages/spatial/src/index.ts
packages/spatial/README.md
packages/schema/src/commands/layout.ts
packages/schema/src/commands/camera.ts
packages/schema/src/catalog.ts
packages/schema/src/catalog.test.ts
packages/schema/src/generated/
packages/core/src/commands/layout.ts
packages/core/src/commands/camera.ts
packages/core/src/commands/index.ts
packages/core/src/commands/*.test.ts
docs/questions.md
```

## Acceptance criteria

1. Catalog names: `layout.placeOn`, `layout.snapToGround`, `layout.alignTo`, `layout.distribute`, `layout.arrangeGrid`, `layout.scatter`, `layout.lookAt`, `layout.resolveOverlaps`, `camera.fit`. Each `tier: 2`, tags include `mutating` and `macro`.
2. Inputs match the §8.5 table. `layout.scatter.count` is 1–500; `seed` is required on scatter. Same document + input (+ seed) → same snapshot (`INV-CMD-08`).
3. Behavior matches the spec table (placeOn keeps rotation; snap along Y; scatter is Poisson-disk duplicates; lookAt faces local −Z; `camera.fit` `iso` uses existing `frameBounds`).
4. Each macro expands only through `ctx.run` of primitive commands. Failed handle leaves the document byte-identical (`INV-CMD-01`, `INV-CMD-02`). Undo/redo for at least one success path per macro (`INV-CMD-04`).
5. `@tessera/spatial` remains Node-safe and must not import `@tessera/core` or `three` Object3D. Coverage ≥ 90% on spatial.

## Tests

| Test | File |
| --- | --- |
| `'INV-CMD-10 catalog names match spec lists'` (includes §8.5) | `packages/schema/src/catalog.test.ts` |
| `'INV-CMD-08 layout macros are deterministic'` | `packages/core/src/commands/layout.test.ts` |
| `'INV-CMD-08 scatter same seed same duplicates'` | `packages/core/src/commands/layout-scatter.test.ts` |
| `'resolveOverlaps separates XZ overlap within iterations'` | `packages/spatial/src/resolve-overlaps.test.ts` |
| `'INV-CMD-01/02 schema and semantic rejection leave snapshot identical'` | `packages/core/src/commands/layout.test.ts` |
| `'INV-CMD-04 undo/redo after arrangeGrid'` | `packages/core/src/commands/layout.test.ts` |

## Non-goals

`checkScene` (T-0208). Rapier. UI buttons. ToolRegistry (T-0205). Inventing `front`/`top` camera Euler formulas beyond `frameBounds` (Q-0123).

## Notes for the implementing agent

Spec names are `layout.snapToGround` and `layout.arrangeGrid`, not `snap` / `grid`. `layout.resolveOverlaps` `ground?: …` is an ellipsis — reuse `EntityRef | 'y0'` (Q-0124). Scatter via `entity.duplicate` + `transform.*`. Touches include schema/core because T-0004 deferred macros; say why in the PR.

---

# T-0207 — AgentRuntime loop: observe → plan → act → verify → repair → report

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/agent` |
| Size | L |
| Depends on | T-0205, T-0206 |
| Status | `in-progress` ([#43](https://github.com/Elshayib/tessera/pull/43)) |

## Goal

`AgentRuntime.run` implements `06` §4. Every mutation uses `CommandBus` with `author.kind = 'agent'` and the run’s `runId` (`INV-AGT-01`). The runtime is testable with a scripted `LlmClient` (`INV-AGT-02`, `INV-AGT-08`).

## Context

- Spec: `docs/06-agent-runtime.md` §3–§7, §9–§12, §14–§15 · `docs/02-architecture.md` §6.2 (`viewportCamera` in `06` wins over `cameraId`, Q-0125)
- Verification **body** is T-0208; this ticket calls an injected `Verifier` and skips when `policy.verify === 'none'` or the document was not mutated
- Spec default `enabledTiers` includes 3; phase 2 omits generation (Q-0126)

## Touches

```
packages/agent/src/runtime.ts
packages/agent/src/runtime.test.ts
packages/agent/src/loop.ts
packages/agent/src/loop.test.ts
packages/agent/src/execute-step.ts
packages/agent/src/errors.ts
packages/agent/src/prompts/*.md
packages/agent/src/prompts/build.ts
packages/agent/src/prompts/build.test.ts
packages/agent/src/compact.ts
packages/agent/src/compact.test.ts
packages/agent/src/json-mode.ts
packages/agent/src/json-mode.test.ts
packages/agent/src/budget.ts
packages/agent/src/budget.test.ts
packages/agent/src/untrusted.ts
packages/agent/src/untrusted.test.ts
packages/agent/src/verifier.ts
packages/agent/src/policy.ts
packages/agent/src/run-types.ts
packages/agent/src/index.ts
packages/agent/README.md
knip.json
docs/questions.md
```

## Acceptance criteria

1. Loop order matches `06` §4. First-step context includes `scene.describe` (outline). `maxChars` = 8% of context window, min 2 KB, max 24 KB. Context uses `RunRequest.context` (`selection`, `viewportCamera`, `focusedEntity`).
2. Distinct planner model → one planner call producing `plan.set` before executor steps.
3. Tool calls in a step run in one `bus.transaction({ author, runId, label })`. Sequential; tier 0 may run in parallel first. Empty change set → no `transaction.committed` (`INV-CMD-03`). Failing mutating call does not abort the step (`06` §7.1).
4. `INV-AGT-01`: mutations have `author.kind === 'agent'` and the run’s `runId`. `revertRun(runId)` restores the pre-run snapshot when no other author acted in between.
5. `INV-AGT-04`: exactly one of `run.completed` | `run.failed` | `run.cancelled`, within `timeoutMs + 5s`. Hard stops leave transactions applied (`06` §12). Two consecutive empty steps → `remainingIssues = ['model produced no actions']`.
6. JSON-mode when `profile.tools === 'json'` (`06` §11). Two consecutive parse failures end the run. `tools === 'none'`: fail the run; do not invent a third protocol.
7. Compaction `06` §7.3. Untrusted strings in `<untrusted source="…">`. `INV-AGT-07`: never exceed `contextTokens − maxOutputTokens − 1_000`.
8. System prompt from `src/prompts/*.md` sections 1–6; snapshot-tested. Few-shots only when `needsExamples`. `RATE_LIMITED`: 3 tries per step then fail.
9. `RunPolicy` defaults from `06` §3 except `enabledTiers` default `[0,1,2]` in this phase (Q-0126). `verify` is `'spatial+vision'` when critic has vision else `'spatial'`.
10. Live apply: do not fork `Y.Doc` (`ADR-0016`). Prompt assembly ≤ 30 ms; tool round-trip ≤ 50 ms p95 excluding model latency (`06` §15).
11. `INV-AGT-08`: same prompt + recorded script → byte-identical transactions. Split if > 600 loc excluding tests/prompts.

## Tests

| Test | File |
| --- | --- |
| `'INV-AGT-01 mutations author.kind agent and runId'` | `packages/agent/src/loop.test.ts` |
| `'INV-AGT-01 revertRun restores snapshot when no other author'` | `packages/agent/src/loop.test.ts` |
| `'INV-AGT-04 completes failed or cancelled within timeout'` | `packages/agent/src/loop.test.ts` |
| `'INV-AGT-05 no mutating tool outside step transaction'` | `packages/agent/src/loop.test.ts` |
| `'INV-AGT-07 request fits context window'` | `packages/agent/src/compact.test.ts` |
| `'INV-AGT-08 identical script identical transactions'` | `packages/agent/src/loop.test.ts` |
| `'INV-AGT-06 confirmDestructive still enforced in loop'` | `packages/agent/src/loop.test.ts` |
| `'two consecutive empty steps remainingIssues'` | `packages/agent/src/loop.test.ts` |
| `'json-mode parse then two failures end run'` | `packages/agent/src/json-mode.test.ts` |
| `'prompt snapshots'` | `packages/agent/src/prompts/build.test.ts` |
| `'untrusted wrapper'` | `packages/agent/src/untrusted.test.ts` |

## Non-goals

`checkScene` / vision critic (T-0208). Review/chat UI. `evals/`. `dryRun`. Tier 3/4 tools. IndexedDB transcripts (T-0210).

## Notes for the implementing agent

Use T-0212 `FakeLlmClient` if `done`; otherwise a scripted `LlmClient` in tests. No network.

---

# T-0208 — Verification: spatial checks then screenshots (vision critic optional)

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/agent` (`checkScene` in `@tessera/spatial`) |
| Size | M |
| Depends on | T-0207, T-0107 |
| Status | `in-progress` ([#44](https://github.com/Elshayib/tessera/pull/44)) |

## Goal

After a mutating run, verification is spatial first, then optional vision critic (`06` §8). Spatial uses `@tessera/spatial` `checkScene`. Screenshots use query `view.screenshot`. If the critic has no vision, visual verification is skipped (`06` §11).

## Context

- Spec: `docs/06-agent-runtime.md` §4 verify loop, §8 · `docs/04-command-bus.md` §10 `view.screenshot`
- Flag: `apps/web/src/flags.ts` `agentVerifyLoop` (default false). `06` §8.2 names `preset` / `background`; `04` §10 does not (Q-0127)
- Ticket package is agent; `checkScene` belongs in spatial (`06` §8.1, Q-0128)

## Touches

```
packages/spatial/src/check-scene.ts
packages/spatial/src/check-scene.test.ts
packages/spatial/src/size-priors.json
packages/spatial/src/index.ts
packages/agent/src/verify/spatial.ts
packages/agent/src/verify/spatial.test.ts
packages/agent/src/verify/vision.ts
packages/agent/src/verify/vision.test.ts
packages/agent/src/verify/screenshots.ts
packages/agent/src/verify/screenshots.test.ts
packages/agent/src/verifier.ts
packages/agent/src/verifier.test.ts
packages/agent/src/runtime.ts
packages/agent/src/loop.ts
packages/agent/src/run-types.ts
apps/web/src/flags.ts
apps/web/src/flags.test.ts
apps/web/src/bootstrap.ts
apps/web/src/editor-context.tsx
docs/questions.md
```

## Acceptance criteria

1. `checkScene(changedEntities)` implements the seven checks in `06` §8.1 with listed severities and `SpatialCheckResult` (optional `suggestedTool` macros). Headless. Spatial ≤ 50 ms on R1 for ≤ 200 changed entities.
2. Order: spatial, then vision only if `policy.verify === 'spatial+vision'` and critic `vision`. Missing engine query → `UNSUPPORTED`; spatial still runs.
3. Screenshots via existing `view.screenshot`: viewport and iso framing changed entities; add top when more than 5 entities changed. Conservative: jpeg size ≤ 1024×576 via `width`/`height` only (Q-0127).
4. Critic output `Verdict` `{ pass, score: 1|2|3|4|5, issues }`. Structured output when supported; else fenced JSON, lenient parse, one retry.
5. Failures feed the executor as a user message prefixed `Verification feedback:` for up to `maxRepairRounds`. `RunReport.verification` is `{ spatial, vision }`.
6. When `agentVerifyLoop` is false, user-facing bootstrap sets `verify: 'none'`. Do not default the flag on.

## Tests

| Test | File |
| --- | --- |
| `'INV-AGT spatial overlap floating buried out-of-bounds'` | `packages/spatial/src/check-scene.test.ts` |
| `'size sanity duplicates orphans'` | `packages/spatial/src/check-scene.test.ts` |
| `'spatial then vision order'` | `packages/agent/src/verifier.test.ts` |
| `'no vision downgrades to spatial'` | `packages/agent/src/verifier.test.ts` |
| `'screenshots viewport iso and top when >5 entities'` | `packages/agent/src/verify/screenshots.test.ts` |
| `'Verdict parse structured and fenced json'` | `packages/agent/src/verify/vision.test.ts` |
| `'repair round Verification feedback prefix'` | `packages/agent/src/verifier.test.ts` |

## Non-goals

Rapier. Changing T-0107 screenshot implementation. Chat UI. Turning `agentVerifyLoop` on by default. Inventing query fields.

## Notes for the implementing agent

`size-priors.json` keys are only those needed by tests. If a suggested macro is missing, omit `suggestedTool` rather than inventing a command.

---

# T-0209 — Review panel + revertRun; live apply (ADR-0016)

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/ui`, `@tessera/agent` |
| Size | M |
| Depends on | T-0207 |
| Status | `in-progress` ([#45](https://github.com/Elshayib/tessera/pull/45)) |

## Goal

Agent changes apply live per step. The review panel groups the run. Accept is a no-op. Revert run calls existing `UndoService.revertRun(runId)` (`06` §9, ADR-0016). `dryRun` is not implemented; flag `agentDryRun` defaults off.

## Context

- Spec: `docs/06-agent-runtime.md` §9 · `docs/adr/ADR-0016-agent-review-model.md` · `docs/04-command-bus.md` `revertRun` · `docs/01` §9
- Core already implements `revertRun`. `packages/ui/src/shell.tsx` has a chat region; no review panel yet
- Global revert keystroke is unspecified (Q-0129)

## Touches

```
packages/ui/src/review/review-panel.tsx
packages/ui/src/review/review-panel.test.ts
packages/ui/src/review/review-panel.browser.test.tsx
packages/ui/src/review/run-group.ts
packages/ui/src/review/run-group.test.ts
packages/ui/src/i18n/en.ts
packages/ui/src/shell.tsx
packages/ui/src/index.ts
apps/web/src/flags.ts
apps/web/src/flags.test.ts
docs/questions.md
```

## Acceptance criteria

1. Live apply: panel reads committed transactions with `author.kind === 'agent'`. No forked `Y.Doc`. UI marks agent working and shows the `plan.set` checklist when present.
2. One run group per `runId`; merged change set; each step listed.
3. Accept does nothing to the document. Revert run: `undo.revertRun(runId)` only. Revert step: `undo({ kind: 'run', runId })`.
4. Last agent run is revertible with one keystroke while the conversation is open (`06` §9). If no global chord is specified, a focused Revert run control that activates with one key is enough (Q-0129). No confirm dialog for undoable revert (`01` §9).
5. `agentDryRun` on `Flags`, default false, `?flag=agentDryRun` in dev. No forked-doc path.
6. Review UI state is not written to the document (`INV-ARCH-04`). Strings in `i18n/en.ts`.

## Tests

| Test | File |
| --- | --- |
| `'INV-AGT-01 revert run calls undo.revertRun'` | `packages/ui/src/review/review-panel.test.ts` |
| `'INV-ARCH-04 review UI state not in document'` | `packages/ui/src/review/run-group.test.ts` |
| `'accept is a no-op'` | `packages/ui/src/review/review-panel.test.ts` |
| `'live apply groups transactions by runId'` | `packages/ui/src/review/run-group.test.ts` |
| `'agentDryRun default false'` | `apps/web/src/flags.test.ts` |
| `'review panel keyboard operable'` | `packages/ui/src/review/review-panel.browser.test.tsx` |

## Non-goals

Chat transcripts (T-0210). Implementing dry-run. Settings. Changing `UndoService`.

## Notes for the implementing agent

The panel uses the same `UndoService` as the rest of the UI. Do not import `three` or vendor SDKs.

---

# T-0210 — Chat panel, transcripts, traces (`15`)

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/ui`, `@tessera/agent` |
| Size | L |
| Depends on | T-0209 |
| Status | `in-progress` ([#46](https://github.com/Elshayib/tessera/pull/46)) |

## Goal

The shell chat region streams `AgentRuntime.run`. Transcripts persist per project and are never synced (`06` §13). Every run writes a `RunTrace` (`INV-OBS-03`). Export is redacted JSON. Live token/cost counters from `UsageLedger` (`07` §7).

## Context

- Spec: `docs/06-agent-runtime.md` §3, §13 · `docs/15-observability.md` §3–§4 · `docs/07-providers.md` §7
- Desktop `.tessera-local/transcripts/` is phase 5 — IndexedDB + memory only
- `TranscriptEntry` / `ConversationSummary` fields are underspecified (Q-0130)

## Touches

```
packages/agent/src/transcript/store.ts
packages/agent/src/transcript/store.test.ts
packages/agent/src/transcript/memory.ts
packages/agent/src/transcript/idb.ts
packages/agent/src/transcript/idb.test.ts
packages/agent/src/trace.ts
packages/agent/src/trace.test.ts
packages/agent/src/usage-ledger.ts
packages/agent/src/usage-ledger.test.ts
packages/agent/src/index.ts
packages/agent/README.md
packages/ui/src/chat/chat-panel.tsx
packages/ui/src/chat/chat-panel.test.ts
packages/ui/src/chat/chat-panel.browser.test.tsx
packages/ui/src/chat/trace-view.tsx
packages/ui/src/chat/trace-view.test.ts
packages/ui/src/i18n/en.ts
packages/ui/src/shell.tsx
packages/ui/src/index.ts
apps/web/src/bootstrap.ts
apps/web/src/app.tsx
apps/web/src/editor-context.tsx
packages/agent/src/run-types.ts
packages/agent/src/transcript/export.ts
packages/agent/src/observability.ts
packages/agent/package.json
packages/agent/tsconfig.json
docs/questions.md
```

Extra vs original Touches: `run-types.ts` (spec `RunRequest.attachments`), `transcript/export.ts` (shared redaction), `observability.ts` + package `exports` (UI imports without loading `node:fs` prompt assembly), `editor-context.tsx` / `app.tsx` (mount chat; Q-0142).

## Acceptance criteria

1. Chat: prompt + image attachments → `RunRequest`. Context = selection + viewport camera when the app exposes it. Streams `RunEvent`s. Cancel maps to `runtime.cancel(runId)`.
2. `TranscriptStore.recent` returns compacted messages within `tokenBudget`. Stored per project; never synced.
3. `INV-OBS-03`: finished runs have `RunTrace` with root `run` span and one `step` span per model call (`15` §4).
4. `exportRun` is redacted; attachments stripped unless requested. `INV-OBS-01`: no network egress from traces/transcripts.
5. Chat header shows live `agent.tokens` and `agent.costUsd`. “Show trace” and “Export run” exist.
6. `ask_user` surfaces in the panel; confirmation sets `confirmDestructive` for the rest of the run.
7. Chat UI state is not in the document (`INV-ARCH-04`). Agent must not import `react` or `ai`. UI must not import `providers-llm`.

## Tests

| Test | File |
| --- | --- |
| `'INV-OBS-03 run trace root run and step per model call'` | `packages/agent/src/trace.test.ts` |
| `'INV-OBS-01 exportRun does not fetch'` | `packages/agent/src/transcript/store.test.ts` |
| `'recent respects tokenBudget'` | `packages/agent/src/transcript/store.test.ts` |
| `'exportRun redacts secrets and strips attachments'` | `packages/agent/src/transcript/store.test.ts` |
| `'UsageLedger per run conversation project'` | `packages/agent/src/usage-ledger.test.ts` |
| `'INV-ARCH-04 chat state not in document'` | `packages/ui/src/chat/chat-panel.test.ts` |
| `'chat streams run events and cancel'` | `packages/ui/src/chat/chat-panel.test.ts` |
| `'chat panel keyboard'` | `packages/ui/src/chat/chat-panel.browser.test.tsx` |

## Non-goals

Settings BYOK (T-0211). Eval runner. Diagnostics ZIP (`15` §5). MCP. Desktop filesystem transcripts. Enabling `agentDryRun`.

## Notes for the implementing agent

`runId` is `r_…` via `newId('r')`. `@tessera/agent` must not import `@tessera/providers-llm`.

---

# T-0211 — Settings: BYOK providers, model picker, budgets

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/ui` |
| Size | M |
| Depends on | T-0203 |
| Status | `in-progress` ([#47](https://github.com/Elshayib/tessera/pull/47)) |

## Goal

A Settings panel configures built-in LLM providers (BYOK), models per role, and run budgets. Keys stay in the vault. Nothing is written into the document (`INV-ARCH-04`).

## Context

- Spec: `docs/07-providers.md` §4–§7 · `docs/06-agent-runtime.md` §3 `RunPolicy`, §10 roles · `docs/14` SEC-02, SEC-03
- Do not turn on `agentVerifyLoop` here

## Touches

```
packages/ui/src/settings/**
packages/ui/src/i18n/en.ts
packages/ui/src/index.ts
packages/ui/README.md
docs/questions.md
```

Extra vs original Touches: `packages/agent/src/usage-ledger.ts` (`monthlyByProvider`, Q-0144); `apps/web` bootstrap/App/`EditorContext.keyVault` so Settings can be injected; empty-viewport Linux PNG + canvas mask (`apps/web/e2e`) because Settings chrome is in the page screenshot.

## Acceptance criteria

1. User can set/delete API keys through `KeyVault`. Unencrypted storage shows the spec warning (`07` §6). Locked vault requires passphrase before keys are used.
2. Provider ids: `openai`, `anthropic`, `google`, `xai`, `deepseek`, `openrouter`, `ollama`, `openai-compatible`. Ollama settings document `OLLAMA_ORIGINS`. `openai-compatible` shows the configured origin (SEC-02). Built-in keys cannot be re-pointed without a new entry.
3. Model picker: `ModelRef` per `planner` | `executor` | `critic`. `listModels` when `listsModels`. `testConnection` for the connection test.
4. Budgets editable from `RunPolicy` (`06` §3) with the listed defaults. Enforcement stays in the runtime/ledger.
5. Settings show monthly totals per provider from `UsageLedger`. Keys never appear in documents, exports, logs, or traces.
6. UI must not import `ai` / `@ai-sdk/*`. Desktop keychain and generation settings are out of scope.

## Tests

| Test | File |
| --- | --- |
| `'vault warning shown when unencrypted'` | `packages/ui/src/settings/settings.test.ts` |
| `'SEC-02 openai-compatible origin visible'` | `packages/ui/src/settings/settings.test.ts` |
| `'INV-ARCH-04 provider settings not in document snapshot'` | `packages/ui/src/settings/settings.test.ts` |
| `'RunPolicy defaults match 06 §3'` | `packages/ui/src/settings/policy.test.ts` |
| `'role model refs planner executor critic'` | `packages/ui/src/settings/models.test.ts` |
| `'keys not present in rendered text after set'` | `packages/ui/src/settings/settings.test.ts` |

## Non-goals

Chat panel (T-0210). Review panel. Reimplementing probes. Diagnostics ZIP. CORS proxy Worker. Extra settings (theme, keybindings).

## Notes for the implementing agent

Inject `KeyVault` / `ProviderRegistry` / `UsageLedger`. Copy for the unencrypted vault and Ollama must match the spec.

---

# T-0212 — `@tessera/testing` FakeLlmClient + Replay/Recording

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/testing` |
| Size | M |
| Depends on | T-0201 |
| Status | `todo` |

## Goal

`@tessera/testing` exports `FakeLlmClient`, `ReplayLlmClient`, and `RecordingLlmClient` (`13` §3–§4) so agent tests and evals never hit the network in CI (`INV-TST-01`, `INV-TST-04`).

## Context

- Spec: `docs/13-testing-and-evals.md` §3–§4, §9
- Current testing package has no FakeLlm. `LlmClient` is T-0201

## Touches

```
packages/testing/src/fake-llm-client.ts
packages/testing/src/fake-llm-client.test.ts
packages/testing/src/replay-llm-client.ts
packages/testing/src/replay-llm-client.test.ts
packages/testing/src/recording-llm-client.ts
packages/testing/src/recording-llm-client.test.ts
packages/testing/src/fetch-guard.ts
packages/testing/src/fetch-guard.test.ts
packages/testing/src/index.ts
packages/testing/README.md
```

## Acceptance criteria

1. `FakeLlmClient.script([{ expectPromptIncludes?, respond: { text?, toolCalls? } }, …])` implements `LlmClient`. Records every request. Presets `noTools`, `noVision`, `smallContext`.
2. `RecordingLlmClient` with `TESSERA_RECORD=1` writes `fixtures/recordings/<provider>/<suite>/<case>.<model>.json` (normalized request, response, usage, redaction: keys, dates → `<ts>`, request ids).
3. `ReplayLlmClient` matches hash of `(model, messages without volatile fields, tool names)`. Miss message includes `no recording for request hash` and `TESSERA_RECORD=1`.
4. Fixture scan finds no secrets (`INV-TST-04`). Fetch guard fails on non-loopback hosts (`INV-TST-01`). Recordings older than 180 days **warn** (`13` §4).

## Tests

| Test | File |
| --- | --- |
| `'FakeLlmClient script expectPromptIncludes then toolCalls'` | `packages/testing/src/fake-llm-client.test.ts` |
| `'presets noTools noVision smallContext'` | `packages/testing/src/fake-llm-client.test.ts` |
| `'ReplayLlmClient miss message mentions TESSERA_RECORD=1'` | `packages/testing/src/replay-llm-client.test.ts` |
| `'RecordingLlmClient redacts keys and timestamps'` | `packages/testing/src/recording-llm-client.test.ts` |
| `'INV-TST-04 fixture scan finds no secrets'` | `packages/testing/src/recording-llm-client.test.ts` |
| `'INV-TST-01 fetch guard rejects non-loopback'` | `packages/testing/src/fetch-guard.test.ts` |

## Non-goals

Eval runner (T-0213). `expectScene` (T-0213). `FakeGenerationProvider`. Live recording in CI.

## Notes for the implementing agent

Depend on `@tessera/llm` types only. Do not import `ai`.

---

# T-0213 — `evals/` runner + core-20 cases (`13` §5.4)

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `evals` |
| Size | L |
| Depends on | T-0207, T-0212 |
| Status | `todo` |

## Goal

`evals/runner` runs the core-20 suite in **replay** with `ReplayLlmClient`. `pnpm eval:replay` is deterministic and has no provider network (`INV-TST-01`). Every case in `13` §5.4 exists as an `EvalCase`.

## Context

- Spec: `docs/13-testing-and-evals.md` §5.1–§5.4, §9 · `docs/01` evals-replay path filter
- Root already has `eval:replay`; workspace does not yet include `evals/`
- `core.generate-barrel` needs generation (phase 3) (Q-0131)
- `core.fix-scene` needs `checkScene` (T-0208)

## Touches

```
evals/package.json
evals/src/runner.ts
evals/src/runner.test.ts
evals/src/types.ts
evals/suites/core/*.eval.ts
evals/suites/core/catalog.test.ts
evals/README.md
pnpm-workspace.yaml
.github/workflows/ci.yml
packages/testing/src/expect-scene.ts
packages/testing/src/expect-scene.test.ts
packages/testing/src/index.ts
packages/testing/README.md
docs/questions.md
```

## Acceptance criteria

1. CLI matches `13` §5.2. Root `pnpm eval:replay` uses `--mode replay`.
2. Replay uses `ReplayLlmClient` and recordings. No network. Missing recordings fail scored `core-20` cases.
3. Live mode is not invoked by CI. Scoring: `hardScore = passed weight / total weight`. Replay must not write the public live leaderboard.
4. `expectScene` implements the `13` §5.3 names. All 20 ids exist with `core-20` tag. `core.generate-barrel` tagged `needs-generation` and **not scored** in phase-2 replay (Q-0131). `core.hdri` uses a committed recorded fixture.
5. `core.delete-trees` covers `confirmDestructive` false and true. `core.describe`: zero transactions.
6. If `checkScene` is not yet available, exclude `core.fix-scene` from the scored set and record it in the PR — do not invent a second checker.

## Tests

| Test | File |
| --- | --- |
| `'INV-TST-01 replay runner does not fetch non-loopback'` | `evals/src/runner.test.ts` |
| `'core-20 suite lists exactly the 20 ids from 13 §5.4'` | `evals/suites/core/catalog.test.ts` |
| `'needs-generation tagged on core.generate-barrel and skipped in phase-2 replay scoring'` | `evals/suites/core/catalog.test.ts` |
| `'expectScene toHaveEntity / toBeOnGround'` | `packages/testing/src/expect-scene.test.ts` |
| `'replay miss fails with TESSERA_RECORD hint'` | `evals/src/runner.test.ts` |

## Non-goals

Extended suites (`13` §5.5). Live CI. Implementing `checkScene`. Phase-3 generation providers. `.skip` on scored cases to go green.

## Notes for the implementing agent

`INV-TST-02` two-provider recordings are demonstrated in T-0215; this ticket must make the layout and case ids ready.

---

# T-0214 — R3F code export

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `@tessera/exporters` |
| Size | M |
| Depends on | T-0111 |
| Status | `todo` |

## Goal

`code-r3f` exporter emits TypeScript `Scene.tsx` that uses `useGLTF`, `Environment`, lights and camera, with props for the model URL (`09` §6). Snapshot-tested, deterministic.

## Context

- Spec: `docs/09-export-and-bridges.md` §2, §6, `INV-EXP-01`
- Sibling: `packages/exporters/src/code-three.ts`
- T-0111 deferred R3F

## Touches

```
packages/exporters/src/code-r3f.ts
packages/exporters/src/code-r3f.test.ts
packages/exporters/fixtures/code-r3f/**
packages/exporters/src/index.ts
packages/exporters/README.md
```

## Acceptance criteria

1. Exporter `id` is `code-r3f`; `fileExtensions` include `tsx`.
2. Output includes `Scene.tsx` using `useGLTF`, `Environment`, lights and camera; props for the model URL.
3. Fixed printer (no user formatter). Header comment includes Tessera version and license summary of assets (`09` §6).
4. Snapshot-stable when `deterministic` (or the shared options equivalent) is set.
5. Reads only document + blob store; no `@tessera/engine` (`INV-EXP-01`).

## Tests

| Test | File |
| --- | --- |
| `'code-r3f snapshot'` | `packages/exporters/src/code-r3f.test.ts` |
| `'Scene.tsx mentions useGLTF and Environment'` | `packages/exporters/src/code-r3f.test.ts` |
| `'INV-EXP-01 exporters do not import engine'` | `packages/exporters/src/isolation.test.ts` |

## Non-goals

Playwright running generated R3F. Bridges. Changing `code-three`. Bundler-specific templates. Expanding CLI unless tests cannot reach the exporter.

## Notes for the implementing agent

Reuse glTF bundle + options from `code-three`. Named export factory; no default export.

---

# T-0215 — Phase 2 exit: core-20 ≥ 90% replay, two providers

| Field | Value |
| --- | --- |
| Phase | 2 |
| Package | `evals` / `docs` |
| Size | S |
| Depends on | T-0213 |
| Status | `todo` |

## Goal

Phase 2 exit in `17` is demonstrable: core-20 hard-assertion pass ≥ 90% in replay for **two** distinct providers (`INV-TST-02`), committed recordings, no CI network. A runbook exists for the human “3 scripted tasks by prompt alone” check. Do not git-tag `m2-agent-v1`.

## Context

- Spec: `docs/17-roadmap.md` phase 2 · `docs/13` §5.2, §5.4, `INV-TST-01`/`02`/`04`
- Pattern: T-0122 / Q-0025
- Scored set excludes `needs-generation` (`core.generate-barrel`) until phase 3 (Q-0131). 90% applies to the remaining scored ids

## Touches

```
docs/runbooks/phase-2-agent-check.md
docs/17-roadmap.md
evals/fixtures/recordings/**
evals/reports/
scripts/check-phase-2-exit.test.ts
evals/suites/core/recordings.test.ts
docs/questions.md
```

## Acceptance criteria

1. Replay of the scored core-20 set is ≥ 90% hard-assertion pass for two distinct `providerId`s from `07` §4.
2. Every scored case has recordings for those two providers (`INV-TST-02`). `needs-generation` is documented as deferred, not counted as a pass.
3. CI replay uses fixtures only (`INV-TST-01`). Fixtures pass the secret scan (`INV-TST-04`).
4. Runbook lists `pnpm eval:replay`, recording paths, what “90%” means, and three scripted prompt-only tasks using only `13` §5.4 prompts (do not invent new capabilities).
5. Roadmap phase 2 row is not marked complete until human tester evidence is attached. No `m2-agent-v1` tag from the agent.

## Tests

| Test | File |
| --- | --- |
| `'runbook exists and names two providers and 90%'` | `scripts/check-phase-2-exit.test.ts` |
| `'INV-TST-02 scored core-20 cases have two provider recording paths'` | `evals/suites/core/recordings.test.ts` |
| `'INV-TST-04 recordings contain no secrets'` | `evals/suites/core/recordings.test.ts` |

## Non-goals

Cutting the `m2-agent-v1` tag. Live evals in CI. Extended suites. Claiming the non-technical tester trial is done without attached human evidence.

## Notes for the implementing agent

Do not lower 90% or drop `INV-TST-02`. Maintainers produce recordings with `TESSERA_RECORD=1` locally; this ticket commits redacted fixtures and the existence gate.

Extra vs original Touches: `pnpm-lock.yaml` (T-0213 dropped `@tessera/spatial` from `@tessera/testing` without refreshing the lockfile); `apps/web` `bootstrap.ts` / `editor-context.tsx` / `isolation.test.ts` so the editor imports `@tessera/agent/observability` (Q-0143) and Vite does not bundle `prompts/build.js` (`node:fs`).
