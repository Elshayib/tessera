# `@tessera/llm`

Vendor-free language-model interfaces. The agent and UI depend on this package; AI SDK adapters live in `@tessera/providers-llm` (`ADR-0007`, `INV-PRV-01`).

## Public API

| Export | Description |
| --- | --- |
| `LlmClient`, `LlmRequest`, `LlmResponse`, `LlmStreamEvent` | Generate / stream / list / test-connection |
| `ModelRef`, `ModelDescriptor`, `ProviderDescriptor`, `Capabilities` | Model metadata; `declared` is partial |
| `KeyVault`, `ProviderRegistry`, `ProviderConfig`, `LlmClientFactory` | Interfaces only |
| `mapProviderError` | HTTP and transport → `TesseraError` (`07` §2) |
| `needsCapabilityProbe`, `resolveContextLimits`, `withDefaultMaxTools` | Probe vs assume (`INV-PRV-04`); 32k/4k/64 defaults |
| `systemMessage`, `userText`, `userImage`, `assistantText`, `assistantToolCalls`, `toolResultMessage` | Message builders |

## Dependency rules

Layer 1. May import `@tessera/std` (and `@tessera/schema` if needed later). Must not import `ai`, `@ai-sdk/*`, `@openrouter/*`, `@tessera/core`, `yjs`, React, or `three`.

## Usage example

```ts
import { mapProviderError, needsCapabilityProbe, userText } from "@tessera/llm";

const error = mapProviderError({ kind: "http", status: 401 });
const probe = needsCapabilityProbe({ inCuratedDescriptorList: false });
const message = userText("Add a 1 m cube.");
void error;
void probe;
void message;
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 85% (`01` §7). No network.

## Related specs

- `docs/07-providers.md` §2–§3, §10–§11
- `docs/02-architecture.md` §4–§5
- Ticket T-0201
