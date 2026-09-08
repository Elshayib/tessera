# `@tessera/ui`

React editor chrome: `--t-…` tokens, resizable panel layout (Zustand + localStorage), English messages, and `describeError`.

## Public API

| Export | Description |
| --- | --- |
| `Shell` | Landmarks for viewport, outliner, inspector, chat. |
| `Outliner` | Accessible entity tree; reparent/reorder via `CommandBus`. |
| `useSelectionStore` | UI-only selection (`INV-ARCH-04`). |
| `useLayoutStore` | UI-only panel sizes (`INV-ARCH-04`). |
| `en` | English catalog (`01` §9). |
| `describeError` | Maps `TesseraError.code` to `errors.*` catalog text. |
| `TOKENS_CSS` / `TOKEN_ACCENT` | `--t-color-accent` and the documented token set (Q-0060). |

## Dependency rules

Layer 3. May import React and packages below except `providers-*` and `mcp`. Must not import `three` or Yjs.

## Testing notes

Colocated Vitest + happy-dom for `*.browser.test.ts`. Coverage ≥ 70%.

## Related specs

- `docs/01-engineering-standards.md` §5–§6, §9
- `docs/02-architecture.md` INV-ARCH-04
- Ticket T-0112, T-0113
