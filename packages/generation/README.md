# `@tessera/generation`

Vendor-free generation-provider interfaces. The agent and assets façade depend on this package; vendor adapters live in `@tessera/providers-generation` (`ADR-0007`, `INV-PRV-01`).

## Public API

| Export | Description |
| --- | --- |
| `GenerationProvider`, `GenerationRequest`, `GenerationResult` | `estimate` / `submit` / `poll` / `fetchResult` / optional `cancel` |
| `GenerationProviderDescriptor`, `GenerationProviderId` | Catalog row; built-in ids `meshy`, `tripo`, `rodin`, `hf-trellis2`, `local-worker` |
| `BUILTIN_GENERATION_PROVIDER_IDS` | The five built-in adapter ids from `07` §8.2 |

## Dependency rules

Layer 1. May import `@tessera/std` and `@tessera/schema`. Must not import generation vendor SDKs, hardcode vendor URLs, `@tessera/core`, `yjs`, React, or `three`.

## Usage example

```ts
import type { GenerationProvider, GenerationRequest } from "@tessera/generation";

const request: GenerationRequest = { kind: "mesh", prompt: "low-poly barrel", pbr: true, style: "lowpoly" };
void request satisfies GenerationRequest;
void (null as unknown as GenerationProvider | null);
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 85% (`01` §7). No network. `FakeGenerationProvider` lives in `@tessera/testing` (T-0304).

## Related specs

- `docs/07-providers.md` §8, §10–§11
- `docs/02-architecture.md` §4–§5
- Ticket T-0304
