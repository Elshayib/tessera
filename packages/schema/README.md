# `@tessera/schema`

Zod 4 document schema for Tessera: types, validation levels 1–3, canonical JSON, primitive bounds, and identity migration for `0.1.0`.

## Public API

| Export | Description |
| --- | --- |
| `DocumentSchema`, `Document` | Document v0.1.0 root. |
| `validateDocument` | Schema + referential + structural validation. |
| `canonicalize` | Sorted-key snapshot JSON (INV-DOC-08). |
| `migrate` | Identity for `0.1.0`; `UNSUPPORTED` for unknown versions. |
| `primitiveBounds` | Analytic AABB for geometry primitives. |
| `emptyDocument` | Valid empty document. |
| Component and asset schemas/types | Field names match `docs/03-domain-model.md`. |

## Dependency rules

Layer 0. May import `@tessera/std` and `zod`. Must not import `core`, engine, or Node builtins.

## Usage example

```ts
import { emptyDocument, validateDocument } from "@tessera/schema";

const report = validateDocument(emptyDocument());
```

## Testing notes

Colocated Vitest tests plus `fixtures/documents/0.1.0/*.json`. Coverage ≥ 95%.

## Related specs

- `docs/03-domain-model.md`
- ADR-0006, ADR-0013, ADR-0014
- Ticket T-0003
