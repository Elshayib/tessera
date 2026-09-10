# `@tessera/agent`

Capability probing and role assignment for the Tessera agent (`06`, `07` §3). The run loop is T-0207.

## Public API

| Export | Description |
| --- | --- |
| `probeModel` | ≤ 4 `LlmClient.generate` probes → `CapabilityProfile` |
| `createProbeCache`, `PROBE_CACHE_TTL_MS` | 7-day in-memory cache |
| `resolveRoles` | `request` → project → global; critic omitted when disabled (Q-0120) |
| `CapabilityProfile`, `Role`, `ResolvedRoles` | Types |

## Dependency rules

Layer 2. May import `@tessera/std` and `@tessera/llm`. Must not import `ai`, `@ai-sdk/*`, `@openrouter/*`, `three`, or `@tessera/providers-llm` (`INV-AGT-02`).

## Usage example

```ts
import { createProbeCache, probeModel, resolveRoles } from "@tessera/agent";

const profile = await probeModel({ client, ref, cache, clock });
const roles = resolveRoles({ global: { executor: ref }, executorVision: false });
```

## Testing notes

Colocated Vitest. Inject `FakeClock` and an in-process `LlmClient` double. No network. Coverage ≥ 85%.

## Related specs

- `docs/06-agent-runtime.md` §10–§11
- `docs/07-providers.md` §3
- Ticket T-0204
