# ADR-0007 — Interface packages separate from provider implementations

Status: Accepted · Date: 2026-09-06

## Context
"Any model" is a core promise. Vendor SDKs churn (the AI SDK changed its tool API between majors); generation vendors appear and disappear. The agent runtime must not depend on any of them.

## Decision
- `@tessera/llm` and `@tessera/generation` contain only interfaces and plain types.
- `@tessera/providers-llm` (AI SDK-based) and `@tessera/providers-generation` implement them; the app wires implementations into registries at bootstrap.
- Exactly one file (`providers-llm/src/internal/ai-sdk-bridge.ts`) touches AI SDK types; adapters use the bridge.
- Capability profiles are probed (`07 §3`) so the runtime adapts to models rather than to vendors.

## Alternatives
- Use the AI SDK's types directly throughout the agent: rejected (lock-in, churn propagates everywhere, weaker agents would import vendor code anywhere).
- Only OpenRouter as the single provider: rejected (no local models, single point of failure, pricing dependency).

## Consequences
- Adding a provider = one adapter file + recorded fixtures + a registry entry; no changes to the agent.
- Two extra small packages; dependency-cruiser enforces the boundary (`INV-PRV-01`).
