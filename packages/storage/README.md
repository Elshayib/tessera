# `@tessera/storage`

Blob and project persistence. This package ships in-memory stores and the `.tessera` ZIP archive codec (`03` §10). IndexedDB, OPFS, and filesystem stores are later tickets.

## Public API

| Export | Description |
| --- | --- |
| `BlobStore` / `ProjectStore` / `OpenProject` / `ProjectSummary` | Interfaces from `08` §2. |
| `MemoryBlobStore` | Content-addressed in-memory blobs (`INV-AST-01`). |
| `MemoryProjectStore` | In-memory projects, snapshot JSON, archive import/export. |
| `encodeTesseraArchive` / `decodeTesseraArchive` | ZIP codec with SEC-08 path and size limits. |
| `DEFAULT_ARCHIVE_LIMITS` | 50 MiB per entry and total (`03` snapshot budget). |

`MemoryProjectStore` keeps a canonical `Document` snapshot. `OpenProject.ydoc` is a new `Y.Doc` and is not hydrated here (`@tessera/core` owns the Yjs mapping).

## Dependency rules

Layer 1. May import `@tessera/std`, `@tessera/schema`, `yjs` (construct `Y.Doc` only; no `transact` / `Y.Map.set`), and `fflate`. Must not import `@tessera/core`, `three`, or React. Must not use `node:fs` in Memory\* implementations.

## Usage example

```ts
import { MemoryBlobStore, MemoryProjectStore } from "@tessera/storage";

const blobs = new MemoryBlobStore();
const store = new MemoryProjectStore({ blobs });
const id = await store.create({ name: "Demo" });
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 85% (`01` §7). Archive tests use `fflate` to build malformed zips.

## New dependencies

| Name | License | Why |
| --- | --- | --- |
| `fflate` 0.8.3 | MIT | ZIP encode/decode in browser and Node. No existing dependency speaks ZIP. |
| `yjs` 13.6.32 | MIT | `OpenProject.ydoc` type and empty `Y.Doc` (same version as core). |

## Related specs

- `docs/08-assets-and-storage.md` §2–§5
- `docs/03-domain-model.md` §10
- `docs/14-security-threat-model.md` SEC-08
- Ticket T-0101
