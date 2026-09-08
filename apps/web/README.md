# `@tessera/web`

Vite composition root. Builds {@link EditorContext} (`docs/02-architecture.md` §7) and mounts the UI shell.

## Public API

| Export | Description |
| --- | --- |
| `bootstrap` | Empty project + command bus, queries, undo, jobs, storage, assets. |
| `parseFlags` / `defaultFlags` | Typed flags; `?flag=` only in development. |
| `EditorProvider` / `useEditor` | React context for the composition root. |

## Dependency rules

Layer 3 app. May import packages and React. Engine is a lazy chunk (`engine-entry.ts`).

## Testing notes

Vitest Node for flags and bootstrap. `MemoryProjectStore` in tests. Coverage is not thresholded at the app (root vitest covers `packages/*/src`).

## Related specs

- `docs/02-architecture.md` §7
- `docs/01-engineering-standards.md` §8 bundle
- Ticket T-0115
