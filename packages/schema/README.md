# `@tessera/schema`

Zod 4 document schema for Tessera: types, validation levels 1–3, canonical JSON, primitive bounds, identity migration for `0.1.0`, command/query catalogs, inspector `.meta()`, and JSON Schema emit.

## Public API

| Export | Description |
| --- | --- |
| `DocumentSchema`, `Document` | Document v0.1.0 root. |
| `validateDocument` | Schema + referential + structural validation. |
| `canonicalize` | Sorted-key snapshot JSON (INV-DOC-08). |
| `migrate` | Identity for `0.1.0`; `UNSUPPORTED` for unknown versions. |
| `primitiveBounds` | Analytic AABB for geometry primitives. |
| `emptyDocument` | Valid empty document. |
| `COMMAND_CATALOG`, `QUERY_CATALOG` | v0.1 command and headless query schemas (`04` §8, §10). |
| `ENGINE_QUERY_NAMES` | Engine-backed queries omitted from `QUERY_CATALOG`. |
| `EntityRefSchema`, `ComponentTypeSchema` | Shared command input types. |
| `emitJsonSchema` | Deterministic JSON Schema for the catalogs. |
| `SidecarSchema`, `emitSidecarJsonSchema` | Export sidecar (`09` §4); committed `json-schema/sidecar.v1.json`. |
| Component and asset schemas/types | Field names match `docs/03-domain-model.md`; inspector widgets via `.meta()`. |

Subpath `@tessera/schema/json-schema` re-exports `emitJsonSchema`.

## Dependency rules

Layer 0. May import `@tessera/std` and `zod`. Must not import `core`, engine, or Node builtins.

## Usage example

```ts
import { COMMAND_CATALOG, emptyDocument, validateDocument } from "@tessera/schema";

const report = validateDocument(emptyDocument());
const create = COMMAND_CATALOG.find((command) => command.name === "entity.create");
void report;
void create;
```

Regenerate committed JSON Schema:

```
pnpm --filter @tessera/schema emit-json-schema
```

## Testing notes

Colocated Vitest tests plus `fixtures/documents/0.1.0/*.json`. Coverage ≥ 95%.

## Related specs

- `docs/03-domain-model.md`
- `docs/04-command-bus.md`
- ADR-0006, ADR-0013, ADR-0014
- Tickets T-0003, T-0004
