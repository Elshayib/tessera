# `@tessera/std`

Shared primitives for Tessera (Result, errors, invariant, ids, Logger, Emitter, Clock, abort helpers, redact).

This package currently exports a placeholder constant so the Phase 0 toolchain has a compilation target. The real API is T-0002.

## Public API

| Export | Kind | Description |
| --- | --- | --- |
| `PACKAGE_NAME` | `const` | Package name string `"@tessera/std"`. |

## Dependency rules

Layer 0. Depends on nothing internal. Every other Tessera package may import `@tessera/std`.

## Usage example

```ts
import { PACKAGE_NAME } from "@tessera/std";

void PACKAGE_NAME;
```

## Testing notes

Colocated Vitest tests (`src/*.test.ts`). Coverage threshold: 95% lines and branches (`docs/01-engineering-standards.md` §7).

## Related specs

- `docs/01-engineering-standards.md` §6, §16
- `docs/02-architecture.md` §4, §10
- Ticket T-0001 / T-0002 in `docs/tasks/phase-0.md`
