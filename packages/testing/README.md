# `@tessera/testing`

Fixtures, document builder, `FakeClock`, `MemoryBlobStore`, `runCommands`, and scripted/replay LLM clients for Tessera tests.

## Public API

| Export | Description |
| --- | --- |
| `docBuilder()` | Fluent builder: `.entity(name, { parent, transform, mesh, material })`, `.geometry()`, `.material()`, `.build()`. |
| `fixtures.D1()` | Deterministic 10_000-entity / 2_000-asset document (seed `42`, primitives only). |
| `FakeClock` | Injectable `Clock`. Starts at `1_700_000_000_000`; time moves only via `advance(ms)`. |
| `MemoryBlobStore` | Re-export of `@tessera/storage` `MemoryBlobStore` (Q-0009 / T-0101). |
| `runCommands(bus, commands, options)` | Runs commands in order on a duck-typed bus (no `@tessera/core` import; Q-0019). |
| `FakeLlmClient` | Scripted `LlmClient` (`13` §3): `script([{ expectPromptIncludes?, respond }])`, request log, presets `noTools` / `noVision` / `smallContext`. |
| `RecordingLlmClient` | Wraps an `LlmClient`; with `TESSERA_RECORD=1` writes redacted `fixtures/recordings/<provider>/<suite>/<case>.<model>.json`. |
| `ReplayLlmClient` | Matches generate requests by hash of model, stripped messages, and tool names (`13` §4). |
| `installFetchGuard()` | Fails `fetch` to non-loopback hosts (`INV-TST-01`). |

## Dependency rules

Layer 2, test-only. May import `@tessera/schema`, `@tessera/std`, `@tessera/storage`, and `@tessera/llm` (types + message builders only; no `ai` / `@ai-sdk/*`). Production `src` must not import this package (`docs/02-architecture.md` §5).

## Usage example

```ts
import { validateDocument } from "@tessera/schema";
import { docBuilder, FakeClock, FakeLlmClient, fixtures, MemoryBlobStore, runCommands } from "@tessera/testing";

const doc = docBuilder().entity("oak_01", { mesh: "oak" }).material("bark", { baseColor: "#8b5a2b" }).build();
const report = validateDocument(doc);
const clock = new FakeClock();
clock.advance(16);
const blobs = new MemoryBlobStore();
const d1 = fixtures.D1();
const llm = FakeLlmClient.script([{ respond: { text: "ok" } }]);
void report;
void blobs;
void d1;
void runCommands;
void llm;
```

## Testing notes

Colocated Vitest tests. `fixtures.D1` validation is large; the test allows a 60 s timeout. Coverage ≥ 95%. Replay misses mention `no recording for request hash` and `TESSERA_RECORD=1`.

## Related specs

- `docs/13-testing-and-evals.md` §3–§4
- `docs/01-engineering-standards.md` §8
- `docs/08-assets-and-storage.md` §2
- Tickets T-0005, T-0212
