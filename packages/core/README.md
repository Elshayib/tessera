# `@tessera/core`

Yjs-backed live document, snapshot mapping (`03` §9), `DocumentReader`, command bus, undo, headless queries, and an in-memory job queue (`04`). `DocumentWriter` is internal. Direct `yjs` imports stay inside this package (`INV-ARCH-01`).

## Public API

| Export | Description |
| --- | --- |
| `createDocument(opts?)` | Live handle `{ doc, reader }` from an optional snapshot. |
| `createCommandBus(handle, opts?)` | Validates and executes catalog commands inside transactions. Pass `undo: capture` so UndoManager tracks origins. |
| `createUndoService(handle)` | Per-author / per-run Yjs undo (`INV-CMD-04`, `INV-CMD-09`). |
| `createQueryHost(handle, { history })` | Headless `QUERY_CATALOG` (engine names are `UNSUPPORTED`). |
| `createJobQueue(bus, { logger })` | In-memory jobs; `commit` is the only document write. Max 2 running per kind. |
| `describeScene(reader, input?)` | Compact LLM scene text (`04` §11). |
| `toYDoc` / `fromYDoc` | Snapshot ↔ Y.Doc mapping. |
| `DocumentReader` | `getEntity`, `getAsset`, `getBehavior`, `children`, `parentChain`, `resolvePath`, `pathOf`, `entities`, `assets`, `snapshot`, `subscribe`. |
| `deriveChangeSet` / `summarizeChangeSet` | Snapshot-diff change sets (Q-0013). |

`asset.import` is not registered (import pipeline is later).

## Dependency rules

Layer 1. May import `@tessera/std`, `@tessera/schema`, `@tessera/spatial`, `yjs`, and `fractional-indexing`. Must not import engine, UI, or Node builtins. Other packages must not call `Y.Doc.transact` (`INV-ARCH-01`; `pnpm check:yjs`).

Layout macros (`layout.*`, `camera.fit`) expand to primitive `ctx.run` calls (`04` §8.5).

## Usage example

```ts
import { createCommandBus, createDocument, createUndoService } from "@tessera/core";

const { doc } = createDocument();
const undo = createUndoService(doc);
const bus = createCommandBus(doc, { undo: undo.capture });
bus.execute("entity.create", { name: "oak" }, { author: { kind: "user", id: "u1" } });
undo.undo({ kind: "author", authorId: "u1" });
```

## Testing notes

Colocated Vitest tests plus `command-bus.bench.ts` (CI budgets 2 ms primitive / 40 ms 100-command txn) and `command-property.test.ts` (T-0010 seeded create/translate/rename/delete/undo). Coverage ≥ 90%. Tests use `@tessera/testing` builders.

## New dependencies

| Name | License | Why |
| --- | --- | --- |
| `yjs` 13.6.32 | MIT | Document CRDT (`ADR-0003`). |
| `fractional-indexing` 4.0.0 | CC0-1.0 | Sibling `order` keys (`03` §4.3). No existing dependency generates them. |

## Related specs

- `docs/03-domain-model.md` §4.3, §9–§10
- `docs/04-command-bus.md`
- ADR-0003, ADR-0004
- Tickets T-0006, T-0007, T-0008
