# `@tessera/storage`

Blob and project persistence. Memory stores, `.tessera` ZIP archives (`03` §10), and browser IndexedDB / OPFS backends (`08` §2).

## Public API

| Export | Description |
| --- | --- |
| `BlobStore` / `ProjectStore` / `OpenProject` / `ProjectSummary` | Interfaces from `08` §2. |
| `BrowserBlobStore` | Blob store that reports `backend: "opfs" \| "indexeddb"`. |
| `MemoryBlobStore` | Content-addressed in-memory blobs (`INV-AST-01`). |
| `MemoryProjectStore` | In-memory projects, snapshot JSON, archive import/export. |
| `IndexedDbBlobStore` / `createIndexedDbBlobStore` | IndexedDB blobs (`tessera-blobs`). |
| `createOpfsBlobStore` | OPFS blobs with IndexedDB fallback when OPFS is missing. |
| `IndexedDbProjectStore` / `createIndexedDbProjectStore` | `y-indexeddb` per project (`tessera-project-<id>`) plus index `tessera-projects`. |
| `SNAPSHOT_DEBOUNCE_MS` | 5000 ms listing-snapshot debounce (`08` §4). |
| `encodeTesseraArchive` / `decodeTesseraArchive` | ZIP codec with SEC-08 path and size limits. |
| `DEFAULT_ARCHIVE_LIMITS` | 50 MiB per entry and total (`03` snapshot budget). |
| `assertBlobStoreContract` | Shared `INV-AST-01` contract used by Memory and browser tests. |

`MemoryProjectStore` keeps a canonical `Document` snapshot. `OpenProject.ydoc` is a new `Y.Doc` and is not hydrated here (`@tessera/core` owns the Yjs mapping). `IndexedDbProjectStore` attaches `y-indexeddb` on `open` and detaches on `close`. Listing snapshots live in the `tessera-projects` index (Q-0035), not `snapshots/*.json` files.

## Dependency rules

Layer 1. May import `@tessera/std`, `@tessera/schema`, `yjs` (construct `Y.Doc` only; no `transact` / `Y.Map.set`), `y-indexeddb` (this package only), and `fflate`. Must not import `@tessera/core`, `three`, or React. Must not use `node:fs` in Memory\* or browser implementations.

## Usage example

```ts
import { createIndexedDbProjectStore, createOpfsBlobStore } from "@tessera/storage";

const blobs = await createOpfsBlobStore();
const store = await createIndexedDbProjectStore({ blobs });
const id = await store.create({ name: "Demo" });
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 85% (`01` §7). Browser stores run in Node with `fake-indexeddb` (Q-0034). Archive tests use `fflate` to build malformed zips.

## New dependencies

| Name | License | Why |
| --- | --- | --- |
| `fflate` 0.8.3 | MIT | ZIP encode/decode in browser and Node. |
| `yjs` 13.6.32 | MIT | `OpenProject.ydoc` type and empty `Y.Doc` (same version as core). |
| `y-indexeddb` 9.0.12 | MIT | Per-project Yjs persistence (`08` §2). |
| `fake-indexeddb` 6.2.5 (dev) | Apache-2.0 | IndexedDB in Node tests until engine browser-mode (Q-0034). |

## Related specs

- `docs/08-assets-and-storage.md` §2–§5
- `docs/03-domain-model.md` §10
- `docs/14-security-threat-model.md` SEC-08
- Tickets T-0101, T-0102
