# Phase 0 — Foundations

Milestone: `m0-foundations` · Exit: `docs/17-roadmap.md` phase 0
Start at **T-0001**. Do not skip ahead.

---

# T-0001 — Scaffold the monorepo toolchain

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `repo` |
| Size | M |
| Depends on | — |
| Status | `in-progress` |

## Goal

`pnpm install`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` run on an empty-but-valid workspace with a placeholder `@tessera/std` package that exports nothing except a `PACKAGE_NAME` constant (so Turbo/tsc have a target). CI workflow exists.

## Context

- Spec: `docs/01-engineering-standards.md` §2, `docs/adr/ADR-0012-monorepo-toolchain.md`
- Templates: `docs/templates/README.md` (copy destinations)
- Question: `docs/questions.md` Q-0001 (record npm scope after a live registry check)

## Touches

```
package.json                          (from docs/templates/package.root.json)
pnpm-workspace.yaml
.npmrc
.nvmrc
tsconfig.base.json
tsconfig.json
turbo.json
biome.json
.dependency-cruiser.cjs
knip.json
vitest.workspace.ts
lefthook.yml
renovate.json
.changeset/config.json
.github/workflows/ci.yml
packages/std/package.json
packages/std/tsconfig.json
packages/std/src/index.ts
packages/std/src/index.test.ts
packages/std/README.md
docs/questions.md                     (Q-0001 answer)
```

## Acceptance criteria

1. Templates are copied, not rewritten. Versions may be updated to the latest **compatible** releases; record any version drift in the PR.
2. `corepack enable && pnpm install` produces a committed `pnpm-lock.yaml`.
3. `pnpm typecheck && pnpm lint && pnpm depcruise && pnpm knip && pnpm test` exit 0.
4. `packages/std` is named `@tessera/std` if the npm org is free (404 on `https://registry.npmjs.org/@tessera/core`); otherwise `@tessera3d/std` and Q-0001 is answered. All later tickets use whichever scope this ticket records.
5. CI workflow matches `docs/templates/ci.yml` (setup-node reads `.nvmrc`, frozen lockfile).
6. No application code beyond the placeholder export.

## Tests

| Test | File |
| --- | --- |
| `'exports PACKAGE_NAME'` | `packages/std/src/index.test.ts` |

## Non-goals

Implementing Result, ids, or any real std API. Creating other packages. Enabling leftover CI jobs (e2e, size, licenses) — those land when the apps exist.

## Notes for the implementing agent

- Package scripts `build`/`typecheck` on `@tessera/std`: `"typecheck": "tsc -b"`, `"build": "tsc -b"`.
- `packages/std/tsconfig.json` extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`, `include: ["src"]`.
- Do not add ESLint or Prettier.
- On Windows, do not add Bash-only scripts.

---

# T-0002 — `@tessera/std`: Result, errors, invariant, ids, Logger, Emitter, Clock, abort, redact

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/std` |
| Size | L |
| Depends on | T-0001 |
| Status | `in-progress` |

## Goal

Every shared primitive in `docs/01-engineering-standards.md` §6 and `docs/02-architecture.md` §10 exists, is documented, and is tested. Later packages import only this package for these concerns.

## Context

- Spec: `01` §6, §16 · `02` §10 · glossary (`Result`, ids)

## Touches

```
packages/std/src/result.ts
packages/std/src/result.test.ts
packages/std/src/error.ts
packages/std/src/error.test.ts
packages/std/src/invariant.ts
packages/std/src/invariant.test.ts
packages/std/src/id.ts
packages/std/src/id.test.ts
packages/std/src/logger.ts
packages/std/src/logger.test.ts
packages/std/src/emitter.ts
packages/std/src/emitter.test.ts
packages/std/src/clock.ts
packages/std/src/clock.test.ts
packages/std/src/abort.ts
packages/std/src/abort.test.ts
packages/std/src/redact.ts
packages/std/src/redact.test.ts
packages/std/src/index.ts
packages/std/README.md
```

## Deliverables — public API (implement these names)

```ts
ok<T>(value: T): Ok<T>
err<E extends TesseraError>(error: E): Err<E>
isOk<T, E extends TesseraError>(r: Result<T, E>): r is Ok<T>
isErr<T, E extends TesseraError>(r: Result<T, E>): r is Err<E>
map<T, U, E extends TesseraError>(r: Result<T, E>, fn: (v: T) => U): Result<U, E>
andThen<T, U, E extends TesseraError>(r: Result<T, E>, fn: (v: T) => Result<U, E>): Result<U, E>

type ErrorCode = /* exact union in 01 §6 */
tesseraError(code: ErrorCode, message: string, details?: Record<string, unknown>): TesseraError

class InvariantError extends Error { readonly code: 'INVARIANT_VIOLATION' }
invariant(condition: unknown, message: string): asserts condition

type IdPrefix = 'e' | 'a' | 'b' | 't' | 'r' | 'j' | 'p'
newId(prefix: IdPrefix): string          // prefix + '_' + 10 chars from [0-9a-z]
isId(prefix: IdPrefix, value: string): boolean

interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void
  info(event: string, fields?: Record<string, unknown>): void
  warn(event: string, fields?: Record<string, unknown>): void
  error(event: string, fields?: Record<string, unknown>): void
}
createLogger(sinks: readonly LogSink[]): Logger
createMemorySink(capacity?: number): MemorySink   // ring buffer, default 10_000
type LogSink = (level: 'debug'|'info'|'warn'|'error', event: string, fields?: Record<string, unknown>) => void

class Emitter<EventMap extends Record<string, unknown>> {
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): () => void
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void
}

interface Clock { now(): number; nowIso(): string }
const systemClock: Clock

abortError(): TesseraError               // code CANCELLED
throwIfAborted(signal: AbortSignal): void
combineSignals(...signals: AbortSignal[]): AbortSignal

redact(value: unknown): unknown          // keys matching /key|token|secret|authorization|password|cookie/i → '[redacted]'
```

## Acceptance criteria

1. `newId('e')` matches `/^e_[0-9a-z]{10}$/`. 10_000 generated ids are unique.
2. `invariant(false, 'x')` throws `InvariantError` with `code: 'INVARIANT_VIOLATION'`.
3. Emitter listeners that throw are caught; the error is forwarded to an optional `onListenerError` or swallowed after a documented no-op — **decision: log via an optional Logger injected in the constructor `new Emitter({ logger })`; other listeners still run.**
4. `redact` never leaves a secret-looking key intact at any depth (objects and arrays).
5. Coverage ≥ 95% on the package.
6. README lists every export.

## Tests

| Test | File |
| --- | --- |
| Result ok/err/map/andThen | `result.test.ts` |
| Every ErrorCode is constructible | `error.test.ts` |
| `'invariant throws InvariantError'` | `invariant.test.ts` |
| `'newId format and uniqueness'` | `id.test.ts` |
| `'isId rejects wrong prefix and length'` | `id.test.ts` |
| Logger writes to sinks; redact applied to fields | `logger.test.ts` |
| Emitter unsubscribe; listener throw isolation | `emitter.test.ts` |
| `'throwIfAborted returns CANCELLED-shaped error via abortError'` | `abort.test.ts` |
| `'redact nested secret keys'` | `redact.test.ts` |

## Non-goals

Zod. Yjs. UI. A console sink that uses `console.*` in production code — the default sink in tests is the memory sink. A console sink, if added, must live behind `createConsoleSink()` and is allowed to call `console` only inside that function (Biome override for that one file, documented).

---

# T-0003 — `@tessera/schema`: document, components, assets, validate, canonicalize

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/schema` |
| Size | L |
| Depends on | T-0002 |
| Status | `in-progress` |

## Goal

Zod 4 schemas for `Document` v0.1.0 as specified in `docs/03-domain-model.md`. `validateDocument` implements levels 1–3. `canonicalize` is idempotent (`INV-DOC-08`). Primitive bounds helpers exist.

## Context

- Spec: `docs/03-domain-model.md` entire · ADR-0006, ADR-0013, ADR-0014
- Q-0002: keep light defaults in `src/defaults.ts`

## Touches

```
packages/schema/package.json
packages/schema/tsconfig.json
packages/schema/README.md
packages/schema/src/index.ts
packages/schema/src/defaults.ts
packages/schema/src/ids.ts
packages/schema/src/document.ts
packages/schema/src/entity.ts
packages/schema/src/components/*.ts     (one file per component)
packages/schema/src/assets/*.ts
packages/schema/src/environment.ts
packages/schema/src/validate.ts
packages/schema/src/canonicalize.ts
packages/schema/src/bounds-primitives.ts
packages/schema/src/migrations/index.ts
packages/schema/src/**/*.test.ts
packages/schema/fixtures/documents/0.1.0/empty.json
packages/schema/fixtures/documents/0.1.0/campfire.json
```

## Acceptance criteria

1. Types exported match the interfaces in `03` (same field names). Do not rename.
2. `validateDocument` reports `INV-DOC-01` through `INV-DOC-07` (each invariant has a failing fixture).
3. Reserved component names (`03 §5.9`) → `UNSUPPORTED`.
4. Script assets and behavior writes are schema-valid as empty/absent; a dedicated `BehaviorWriteSchema` used later is not required yet — the `behaviors` map accepts empty object only in v0.1 **or** full Behavior objects that still pass validation. Commands that write behaviors land later and return `UNSUPPORTED`.
5. `canonicalize(parse(canonicalize(d))) === canonicalize(d)` (`INV-DOC-08`) including on Windows (LF only).
6. Primitive bounds for box/sphere/cylinder/cone/plane/torus/capsule match `03 §6.2` (analytic).
7. `migrate` is identity for `0.1.0` and `UNSUPPORTED` for unknown newer versions.
8. Coverage ≥ 95%.

## Tests

| Test | File |
| --- | --- |
| `'INV-DOC-01 unique ids across maps'` | `validate.test.ts` |
| `'INV-DOC-02 parent exists'` | `validate.test.ts` |
| `'INV-DOC-03 no parent cycles'` | `validate.test.ts` |
| `'INV-DOC-04 transform required'` | `validate.test.ts` |
| `'INV-DOC-05 rigidBody requires collider'` | `validate.test.ts` |
| `'INV-DOC-06 asset refs resolve and kind-match'` | `validate.test.ts` |
| `'INV-DOC-07 sibling and asset name uniqueness'` | `validate.test.ts` |
| `'INV-DOC-08 canonicalize idempotent'` | `canonicalize.test.ts` |
| range/enum/default for every component field | `components/*.test.ts` |
| reserved component names rejected | `entity.test.ts` |
| primitive bounds | `bounds-primitives.test.ts` |
| empty + campfire fixtures validate | `fixtures.test.ts` |
| migrate unknown version → UNSUPPORTED | `migrations/index.test.ts` |

## Non-goals

Inspector `.meta()` completeness (`INV-DOC-09`) — that is **T-0004**. Command/query schemas — **T-0004**. Yjs mapping — **T-0006**.

---

# T-0004 — `@tessera/schema`: command/query schemas + inspector metadata + JSON Schema emit

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/schema` |
| Size | L |
| Depends on | T-0003 |
| Status | `todo` |

## Goal

Every v0.1 command and query in `docs/04-command-bus.md` §8 and §10 has a Zod input/output schema, description, and tier. Every document field used by the inspector has `.meta()` (`INV-DOC-09`). `emitJsonSchema()` writes generated JSON Schema for MCP/docs.

## Context

- Spec: `04` §3 (CommandSchema), §8, §10 · `03` §13 · ADR-0006

## Touches

```
packages/schema/src/commands/*.ts       (one file per namespace: entity, transform, component, asset, …)
packages/schema/src/queries/*.ts
packages/schema/src/catalog.ts          (COMMAND_CATALOG, QUERY_CATALOG)
packages/schema/src/inspector-meta.ts
packages/schema/src/json-schema.ts
packages/schema/src/generated/          (output of emit script; committed)
scripts/emit-json-schema.ts
packages/schema/package.json            (export "./json-schema")
```

## Acceptance criteria

1. `COMMAND_CATALOG` contains exactly the command names in `04 §8.1–8.4` (no macros yet; macros are phase 2). Each entry has `name`, `description`, `input`, `output`, `tier`, `tags`.
2. `QUERY_CATALOG` contains `04 §10` queries that are not engine-backed. Engine-backed names (`view.screenshot`, `scene.raycast`, `view.getCamera`) are listed in `ENGINE_QUERY_NAMES` as a const array so T-0008 can skip registration headless.
3. A test walks every Zod object field on components and asset kinds and fails if `.meta()` is missing (`INV-DOC-09`).
4. `pnpm --filter @tessera/schema emit-json-schema` is deterministic; generated files are committed.
5. `INV-CMD-10` partial: catalog enumeration test (handlers come in T-0007).

## Tests

| Test | File |
| --- | --- |
| `'INV-CMD-10 catalog names match spec lists'` | `catalog.test.ts` |
| `'INV-DOC-09 every field has inspector metadata'` | `inspector-meta.test.ts` |
| each command input rejects invalid payloads | `commands/*.test.ts` |
| emit is stable (compare to committed generated/) | `json-schema.test.ts` |

## Non-goals

Handlers. Macros (`layout.*`, `camera.fit`). Jobs.

---

# T-0005 — `@tessera/testing`: builders, fixtures D1, FakeClock, MemoryStores, runCommands stub

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/testing` |
| Size | M |
| Depends on | T-0004 |
| Status | `todo` |

## Goal

Test utilities from `docs/13-testing-and-evals.md` §3 that do not require `core` yet: `docBuilder`, `fixtures.D1`, `FakeClock`, `MemoryBlobStore`. `runCommands` is added in T-0008 once the bus exists; this ticket may export a type-only placeholder or wait — **implement `docBuilder` + `D1` + clock + memory blob store only**.

## Context

- Spec: `13` §3 · `01` §8 (D1 = 10_000 entities, 2_000 assets)

## Touches

```
packages/testing/**
```

## Acceptance criteria

1. `docBuilder()` produces documents that pass `validateDocument` with zero errors.
2. `fixtures.D1()` is deterministic given an implicit seed (`42`), has ≥ 10_000 entities and ≥ 2_000 assets, all primitives (no blobs), and validates.
3. `FakeClock` starts at Unix epoch 1_700_000_000_000 unless constructed otherwise; `advance` is the only way time moves.
4. Package may import `@tessera/schema` and `@tessera/std` only.

## Tests

| Test | File |
| --- | --- |
| builder produces valid documents | `doc-builder.test.ts` |
| `'D1 is deterministic and valid'` | `fixtures.test.ts` |
| FakeClock advance | `fake-clock.test.ts` |

## Non-goals

R1–R3 with GPU. FakeLlmClient (phase 2). `expectScene` (phase 2). `runCommands`.

---

# T-0006 — `@tessera/core`: Yjs document facade, reader, writer, snapshot round-trip

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/core` |
| Size | L |
| Depends on | T-0005 |
| Status | `todo` |

## Goal

A `Document` object backed by Yjs using the mapping in `03 §9`. `toYDoc` / `fromYDoc` / `snapshot()` round-trip through `canonicalize`. `DocumentWriter` is **not exported** from the public index (only used inside core). `DocumentReader` is public.

## Context

- Spec: `03` §9–§10 · `04` DocumentReader · ADR-0003
- INV-ARCH-01: no other package will call `Y.Doc.transact` — start `scripts/check-no-direct-yjs.ts` here (allowlist `packages/core`).

## Touches

```
packages/core/**
scripts/check-no-direct-yjs.ts
package.json                            (add script check:yjs, include in lint later or in this package test)
```

## Acceptance criteria

1. `createDocument(opts?: { snapshot?: Document; clock?: Clock; logger?: Logger })` returns `{ doc, reader }` where `reader.snapshot()` equals the input snapshot after canonicalize (or an empty valid document).
2. Reader methods: `getEntity`, `getAsset`, `getBehavior`, `children`, `parentChain`, `resolvePath`, `pathOf`, `entities`, `assets`, `snapshot`, `subscribe`.
3. Internal writer can create/update/delete entity and asset maps; unit tests access it via a `createTestWriter` **test-only export** from `src/internal/document-writer.ts` — not from `src/index.ts`.
4. Empty document has `version: "0.1.0"`, default settings (`03 §3`), empty maps, default environment.
5. Yjs dependency isolated (depcruise).
6. Coverage ≥ 90%.

## Tests

| Test | File |
| --- | --- |
| `'Yjs mapping round-trip equals canonicalize(snapshot)'` | `document.roundtrip.test.ts` |
| `'INV-DOC-02/03 writer rejects missing parent and cycles'` | `document-writer.test.ts` |
| path resolve and children order (fractional index) | `document-reader.test.ts` |
| check-no-direct-yjs script flags a fixture string | `scripts/check-no-direct-yjs.test.ts` (or a fixtures folder) |

## Non-goals

Command bus. Undo. Persistence adapters (IndexedDB).

---

# T-0007 — `@tessera/core`: command bus, transactions, change sets, entity/component/asset/environment commands

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/core` |
| Size | L |
| Depends on | T-0006 |
| Status | `todo` |

## Goal

`CommandBus` implements `04` §3–§5 and §7. All catalog commands in `04 §8.1–8.4` except `asset.import` (job) have handlers. Failed validation and failed handlers leave the document byte-identical.

## Context

- Spec: `04` §3–§8 · invariants INV-CMD-01, 02, 03, 05, 07, 10

## Touches

```
packages/core/src/command-bus.ts
packages/core/src/transaction.ts
packages/core/src/change-set.ts
packages/core/src/summarize-change-set.ts
packages/core/src/commands/**/*.ts
packages/core/src/internal/math.ts          (4×4 TRS, no three.js)
packages/core/src/**/*.test.ts
packages/core/src/command-bus.bench.ts
```

## Acceptance criteria

1. Pipeline steps 1–10 in `04` §4 are implemented. `execute` is synchronous.
2. `INV-CMD-01`, `INV-CMD-02`, `INV-CMD-03`, `INV-CMD-05`, `INV-CMD-07` have tests.
3. Calling `bus.execute` from inside `handle` (instead of `ctx.run`) returns `CONFLICT`.
4. `entity.setParent` with `keepWorldTransform: true` uses `internal/math` only (no `three` import).
5. Name collision suffix `_01`, `_02` per `03 §4.3`.
6. Empty transactions are dropped (`INV-CMD-03`).
7. Bench file exists with thresholds from `01` §8 (primitive command, 100-command txn). On CI machines that are slow, use `expectBench` with 2× slack **only if** documented — prefer failing loud and marking the bench as optional via `describe.skipIf(process.env.CI_WEAK)` **No: do not skip.** Use generous but specified thresholds in CI: 2 ms / 40 ms with a comment pointing at the laptop budgets.
8. Coverage ≥ 90%.

## Tests

| Test | File |
| --- | --- |
| `'INV-CMD-01 invalid input is a no-op'` | `command-bus.test.ts` |
| `'INV-CMD-02 handler Err aborts transaction'` | `command-bus.test.ts` |
| `'INV-CMD-03 empty transaction dropped'` | `transaction.test.ts` |
| `'INV-CMD-05 nested execute from handler is CONFLICT'` | `command-bus.test.ts` |
| `'INV-CMD-07 change set before/after match snapshots'` | `change-set.test.ts` |
| `'INV-CMD-10 every catalog command is registered'` | `registry.test.ts` |
| each command: reject / success / change set | `commands/*.test.ts` |
| setParent cycle; keepWorldTransform | `commands/entity.test.ts` |

## Non-goals

Undo (T-0008). Queries (T-0008). Macros. Jobs. UI.

---

# T-0008 — `@tessera/core`: undo, queries, job queue

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/core` |
| Size | L |
| Depends on | T-0007 |
| Status | `todo` |

## Goal

`UndoService` per `04` §6. Headless queries per `04` §10 (not engine-backed). `JobQueue` per `04` §9.

## Context

- Spec: `04` §6, §9, §10–§11 · INV-CMD-04, INV-CMD-09

## Touches

```
packages/core/src/undo-service.ts
packages/core/src/queries/**/*.ts
packages/core/src/job-queue.ts
packages/core/src/describe-scene.ts
packages/testing/src/run-commands.ts     (now that bus exists)
```

## Acceptance criteria

1. `undo` then `redo` restores canonicalize snapshot (`INV-CMD-04`) for a single author.
2. Two authors on one `Y.Doc`: A’s undo does not revert B (`trackedOrigins`).
3. `revertRun(runId)` removes that run’s transactions even if another author interleaved (`INV-CMD-09`) — test with two Y.Docs or two authors on one doc.
4. `scene.describe` matches the format rules in `04` §11 (golden file on `campfire` fixture).
5. Engine query names are **not** registered (headless).
6. Job: `commit` is the only place the job touches the bus; cancellation returns `CANCELLED`.
7. `runCommands` helper lands in `@tessera/testing`.

## Tests

| Test | File |
| --- | --- |
| `'INV-CMD-04 undo/redo restores snapshot'` | `undo-service.test.ts` |
| `'INV-CMD-09 revertRun with interleaved authors'` | `undo-service.test.ts` |
| per-author isolation | `undo-service.test.ts` |
| describe golden + D1 size ≤ 8 KB default | `describe-scene.test.ts` |
| scene.find glob/tag/component | `queries/find.test.ts` |
| job commit / cancel / concurrency 2 per kind | `job-queue.test.ts` |

## Non-goals

y-indexeddb. Engine queries. UI history panel.

---

# T-0009 — `apps/cli`: `tessera validate` + workspace wiring

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `apps/cli` |
| Size | S |
| Depends on | T-0008 |
| Status | `todo` |

## Goal

`tessera validate <path>` reads a snapshot JSON (or a folder with `project.tessera.json`) and prints a `ValidationReport`. Exit 0 if no level 1–3 errors; exit 2 if errors; exit 1 on I/O. Headless: `three` is not in the CLI module graph (`INV-ARCH-06`).

## Context

- Spec: `03` §12 · `02` §4 · `17` phase 0 exit

## Touches

```
apps/cli/**
packages/schema/fixtures/documents/0.1.0/campfire.json
```

## Acceptance criteria

1. Binary name `tessera` via `bin` in package.json.
2. Validates the campfire fixture with exit 0.
3. A deliberately broken fixture exits 2 and prints invariant ids.
4. A test asserts `three` is not resolvable from the CLI entry graph (can be a depcruise rule `apps/cli` ↛ `three`).
5. Root README “Working on Tessera” mentions `pnpm tessera validate`.

## Tests

| Test | File |
| --- | --- |
| validate good fixture | `apps/cli/src/validate.test.ts` |
| validate bad fixture exit 2 | `apps/cli/src/validate.test.ts` |
| INV-ARCH-06 cli does not depend on three | depcruise (add rule) + this ticket updates `.dependency-cruiser.cjs` |

## Non-goals

`export`, `eval`, `inspect` subcommands (later tickets).

---

# T-0010 — Phase 0 exit audit

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `repo` |
| Size | S |
| Depends on | T-0009 |
| Status | `todo` |

## Goal

Prove `m0-foundations` exit criteria from `docs/17-roadmap.md`. No new features.

## Acceptance criteria

1. Property test: random command sequences (from a documented subset: create, translate, rename, delete, undo) keep `validateDocument` green and full undo returns to the start snapshot (belongs in `packages/core` if missing — add it here).
2. All ADRs 0001–0016 still `Accepted`.
3. Coverage thresholds for `std`, `schema`, `core` hold.
4. `docs/17-roadmap.md` phase 0 row can be marked complete in the PR with the tag name `m0-foundations` (do not git-tag unless a human asks).
5. Every ticket T-0001–T-0009 is `done` with PR links.

## Non-goals

Starting phase 1 UI.
