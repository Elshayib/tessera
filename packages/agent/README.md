# `@tessera/agent`

Capability probing, role assignment, the agent `ToolRegistry`, `AgentRuntime.run`, transcripts, traces, and the usage ledger (`06`, `15`).

## Public API

| Export | Description |
| --- | --- |
| `probeModel` | ≤ 4 `LlmClient.generate` probes → `CapabilityProfile` |
| `createProbeCache`, `PROBE_CACHE_TTL_MS` | 7-day in-memory cache |
| `resolveRoles` | `request` → project → global; critic omitted when disabled (Q-0120) |
| `createToolRegistry` | Derive command/query tools for tiers 0–2 plus meta-tools |
| `selectTools` | Progressive disclosure (`maxTools ≥ 40` vs catalog mode) |
| `suggestionFor` | Fixed `(group, error code)` suggestion table (`06` §7.2) |
| `createAgentRuntime` | Observe → plan → act → verify loop (`06` §4, §8); `cancel` aborts the in-flight `LlmClient.stream` |
| `createSceneVerifier` / `createSkipVerifier` | Spatial then optional vision critic |
| `createMemoryTranscriptStore` / `createIndexedDbTranscriptStore` | Project-local transcripts; never synced (`06` §13) |
| `buildRunTrace` | Root `run` span plus one `step` span per model call (`INV-OBS-03`) |
| `createUsageLedger` | Per run / conversation / project token and cost totals (`07` §7) |
| `@tessera/agent/observability` | Transcripts, traces, and ledger without importing the run loop (for `@tessera/ui`) |
| `CapabilityProfile`, `Role`, `ResolvedRoles`, `ToolRegistry`, `RunPolicy`, `RunRequest` | Types |

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/llm`, `@tessera/schema`, `@tessera/core`, and `@tessera/spatial`. Must not import `ai`, `@ai-sdk/*`, `@openrouter/*`, `three`, or `@tessera/providers-llm` (`INV-AGT-02`). Prompt sections are inlined TypeScript strings so the run loop can load in the browser (Q-0143, Q-0161).

Query tools call `QueryHost.query` when it is present on the `QueryRegistry` object (Q-0136). They never call `tx.run`.

## Usage example

```ts
import { createToolRegistry, selectTools } from "@tessera/agent";

const tools = createToolRegistry();
tools.deriveFromRegistries(bus.registry, queries.registry);
const selected = selectTools(tools, policy, profile);
```

## Testing notes

Colocated Vitest. Inject `FakeClock` and an in-process `LlmClient` double. No network. Coverage ≥ 85%.

## Related specs

- `docs/06-agent-runtime.md` §3, §5, §7.2–§7.4, §10–§11
- `docs/04-command-bus.md` §8, §10
- Tickets T-0204, T-0205, T-0207
