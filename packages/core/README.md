# `@tessera/core`

Yjs-backed live document, snapshot mapping (`03` §9), and `DocumentReader`. The command bus lands in T-0007. `DocumentWriter` is internal (test-only `createTestWriter`).

## Public API

| Export | Description |
| --- | --- |
| `createDocument(opts?)` | Live handle `{ doc, reader }` from an optional snapshot. |
| `toYDoc` / `fromYDoc` | Snapshot ↔ Y.Doc mapping. |
| `DocumentReader` | `getEntity`, `getAsset`, `getBehavior`, `children`, `parentChain`, `resolvePath`, `pathOf`, `entities`, `assets`, `snapshot`, `subscribe`. |

## Dependency rules

Layer 1. May import `@tessera/std`, `@tessera/schema`, and `yjs`. Must not import engine, UI, or Node builtins. Other packages must not call `Y.Doc.transact` (`INV-ARCH-01`; `pnpm check:yjs`).

## Usage example

```ts
import { createDocument } from "@tessera/core";

const { reader } = createDocument();
const version = reader.snapshot().version;
void version;
```

## Testing notes

Colocated Vitest tests plus `scripts/check-no-direct-yjs.test.ts`. Coverage ≥ 90%. Tests use `@tessera/testing` builders and `createTestWriter`.

## New dependencies

| Name | License | Why |
| --- | --- | --- |
| `yjs` 13.6.32 | MIT | Document CRDT (`ADR-0003`). No existing dependency implements this mapping. |

## Related specs

- `docs/03-domain-model.md` §9–§10
- `docs/04-command-bus.md` (DocumentReader)
- ADR-0003
- Ticket T-0006
