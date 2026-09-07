# `@tessera/testing`

Fixtures, document builder, `FakeClock`, and `MemoryBlobStore` for Tessera tests. Later tickets add `runCommands`, scene assertions, and LLM fakes.

## Public API

| Export | Description |
| --- | --- |
| `docBuilder()` | Fluent builder: `.entity(name, { parent, transform, mesh, material })`, `.geometry()`, `.material()`, `.build()`. |
| `fixtures.D1()` | Deterministic 10_000-entity / 2_000-asset document (seed `42`, primitives only). |
| `FakeClock` | Injectable `Clock`. Starts at `1_700_000_000_000`; time moves only via `advance(ms)`. |
| `MemoryBlobStore` | In-memory `BlobStore` (`docs/08` §2): hash, dedupe, abort. |

## Dependency rules

Layer 2, test-only. May import `@tessera/schema` and `@tessera/std` only (T-0005). Production `src` must not import this package (`docs/02-architecture.md` §5).

## Usage example

```ts
import { validateDocument } from "@tessera/schema";
import { docBuilder, FakeClock, fixtures, MemoryBlobStore } from "@tessera/testing";

const doc = docBuilder().entity("oak_01", { mesh: "oak" }).material("bark", { baseColor: "#8b5a2b" }).build();
const report = validateDocument(doc);
const clock = new FakeClock();
clock.advance(16);
const blobs = new MemoryBlobStore();
const d1 = fixtures.D1();
void report;
void blobs;
void d1;
```

## Testing notes

Colocated Vitest tests. `fixtures.D1` validation is large; the test allows a 60 s timeout. Coverage ≥ 95%.

## Related specs

- `docs/13-testing-and-evals.md` §3
- `docs/01-engineering-standards.md` §8
- `docs/08-assets-and-storage.md` §2
- Ticket T-0005
