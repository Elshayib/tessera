# Phase 2 — Agent v1

Milestone: `m2-agent-v1` · Depends on T-0122
T-0200 freezes tickets to phase-0 depth before anyone implements.

| Id | Title | Package | Depends | Status |
| --- | --- | --- | --- | --- |
| T-0200 | Freeze phase-2 tickets | docs | T-0122 | `todo` |
| T-0201 | `@tessera/llm`: LlmClient, capabilities, KeyVault interface | llm | T-0200 | `todo` |
| T-0202 | `@tessera/providers-llm`: AI SDK providers + OpenAI-compatible + Ollama | providers-llm | T-0201 | `todo` |
| T-0203 | Key vault: WebCrypto + IndexedDB; desktop keychain later | providers-llm / web | T-0202 | `todo` |
| T-0204 | Capability probing + role assignment (planner/executor/critic) | agent | T-0202 | `todo` |
| T-0205 | ToolRegistry derived from command/query catalogs + tiers 0–2 | agent | T-0204, T-0004 | `todo` |
| T-0206 | `@tessera/spatial` macros: placeOn, snap, align, distribute, grid, lookAt, fit | spatial | T-0103 | `todo` |
| T-0207 | AgentRuntime loop: observe → plan → act → verify → repair → report | agent | T-0205, T-0206 | `todo` |
| T-0208 | Verification: spatial checks then screenshots (vision critic optional) | agent | T-0207, T-0107 | `todo` |
| T-0209 | Review panel + revertRun; live apply (ADR-0016) | ui, agent | T-0207 | `todo` |
| T-0210 | Chat panel, transcripts, traces (`15`) | ui, agent | T-0209 | `todo` |
| T-0211 | Settings: BYOK providers, model picker, budgets | ui | T-0203 | `todo` |
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
