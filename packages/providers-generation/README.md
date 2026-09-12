# `@tessera/providers-generation`

Meshy, Tripo, Rodin, Hugging Face TRELLIS.2, and local-worker implementations of `GenerationProvider` (`07` §8.2–§8.3).

## Public API

| Export | Description |
| --- | --- |
| `createMeshyProvider` | REST + API key; text/image-to-3D and texture |
| `createTripoProvider` | REST + API key |
| `createRodinProvider` | Hyper3D REST + API key |
| `createHfTrellis2Provider` | Gradio HTTP; text-to-mesh is two-stage via an image provider |
| `createLocalWorkerProvider` | `07` §8.3 HTTP contract |
| `mapGenerationError` | HTTP/transport → `TesseraError` (`INV-PRV-03`) |

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/generation`, `@tessera/storage` (and schema as needed). **This is the only package that may hardcode generation vendor URLs or import a generation vendor SDK** (`INV-PRV-01`).

## Testing notes

Recorded-fixture HTTP via injected `GenerationHttp`. Local worker tests use an in-process fake. Coverage ≥ 85%. No live vendor calls.

## Related specs

- `docs/07-providers.md` §8–§11
- Ticket T-0305
