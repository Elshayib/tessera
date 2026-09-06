# 18 — Implementation playbook (for agents)

Status: Accepted · Last updated: 2026-09-06

This document exists because most Tessera code will be written by AI agents that did not write the specs. Follow it exactly. Do not improvise product behavior. Do not “just get something working.”

## 1. What you are building

A professional, local-first, agent-native 3D scene workspace. The quality bar is `docs/01-engineering-standards.md`. If a change would be rejected at a well-run company (missing tests, `any`, silent failure, leftover console.log, invented API), it is rejected here.

You are **not** writing a demo, a playground, or a prototype that will be rewritten later. The first implementation of a package is the implementation. Interfaces in the specs are contracts.

## 2. Language (do not reopen)

| Code | Language | Why |
| --- | --- | --- |
| Almost everything | **TypeScript, strict** | Fastest path to a correct product: three.js, Yjs, AI SDK, MCP, React, Zod. LLM agents produce it most reliably. GPU work is where “fast” actually lives. |
| `apps/desktop/src-tauri` | **Rust** (Tauri 2) | OS integration only. Phase 5. |
| New WASM kernels | **Rust → WASM** | Only after a CI benchmark proves TypeScript missed a budget in `01 §8`. |
| Shaders | **TSL → WGSL** | Never hand-write GLSL. |
| `bridges/*` | Host language | GDScript / C# / Python. Phase 4+. |

Rationale is closed: `docs/adr/ADR-0001-languages.md`. Do not start a Rust editor, a Python backend, or a C++ core.

“Best and fastest” in Tessera means:

1. **User-perceived speed** — 60 fps viewport, command p95 ≤ 0.5 ms, budgets in `01 §8`. Enforced by benches, not by switching languages.
2. **Agent speed** — TypeScript + Zod + colocated tests so a weaker model can finish a ticket without inventing types.
3. **Ship speed** — one language across web, CLI, MCP, evals.

## 3. Mandatory read order before writing code

1. `AGENTS.md` (this repo’s operating manual)
2. `docs/00-vision.md` (what Tessera is not)
3. `docs/01-engineering-standards.md`
4. `docs/02-architecture.md` §4–§5 (packages + import rules)
5. `docs/glossary.md` (use those words only)
6. The spec your ticket links
7. The ticket itself

If the ticket and the spec disagree, **the spec wins**. File the disagreement in `docs/questions.md`. Do not “fix” the spec by loosening a type.

## 4. How to pick work

1. Open `docs/tasks/README.md`.
2. Take the lowest-id ticket whose status is `todo` and whose `Depends on` tickets are all `done`.
3. Set it to `in-progress` in the same PR that starts the work.
4. Do not start two tickets in one PR. Do not start a ticket that lacks acceptance criteria.

If every unblocked ticket looks too large (> 600 lines excluding tests), split it using `docs/templates/task-template.md` and record the split in the phase file.

## 5. How to implement a ticket (mechanical)

```
claim → read Touches + linked specs → write failing tests from Tests + AC
      → implement only those files → green gates → docs/changeset → self-review
```

### 5.1 Tests first

Copy the ticket’s `Tests` section into real test files. They must fail for the right reason (missing export, failing invariant), not because of a syntax error. Then implement.

Name tests after invariants: `'INV-CMD-04 undo/redo restores snapshot'`.

### 5.2 Stay inside Touches

If you need a file that is not listed:

- Prefer adding it under a listed directory if the spec already named that module (`src/internal/…`).
- Otherwise stop, add a `questions.md` entry, and mention it in the PR. Do not silently create a new package.

### 5.3 Public API

- Named exports only. `src/index.ts` is an explicit re-export list.
- TSDoc on every export. `@example` when the function has more than one parameter or has side effects.
- Update the package `README.md` in the same PR.

### 5.4 Errors

Layer 0–2: return `Result<T, E>`. Throw only via `invariant()` for programmer mistakes.

### 5.5 Gates (all must pass; never skip)

```
pnpm typecheck
pnpm lint
pnpm depcruise
pnpm knip
pnpm test
```

Plus `pnpm test:e2e` when the ticket says so.

## 6. Things weaker models get wrong (do not)

| Mistake | What to do instead |
| --- | --- |
| Mutating Yjs maps from UI or engine | Only `@tessera/core` command handlers call `DocumentWriter` |
| Importing `three` from `core` or `agent` | `core` has its own 4×4 math in `internal/math`. Engine owns three.js |
| Importing `ai` / `@ai-sdk/*` from `agent` | `agent` talks to `@tessera/llm` only |
| Storing selection in the document | Zustand in `@tessera/ui` |
| `as` / `any` / `!` to silence the compiler | Fix the type or narrow with Zod |
| `console.log` | Injected `Logger` |
| Hitting the network in a test | `@tessera/testing` fakes and recordings |
| Inventing extra commands | Catalog in `04-command-bus.md §8` is exhaustive for v0.1 |
| Empty `README` or “TODO later” | Ticket is not done |
| Giant god-file | One concept per kebab-case file |
| Default export | Named exports (except `React.lazy` routes) |

## 7. File-creation checklist for a new package

A ticket that creates `@tessera/<name>` must produce **all** of these:

```
packages/<name>/
  package.json          name "@tessera/<name>", type module, sideEffects false
  tsconfig.json         extends ../../tsconfig.base.json, project references
  README.md             Purpose, public API table, dependency rules, testing
  src/index.ts          explicit re-exports
  src/**/*.ts
  src/**/*.test.ts      colocated
```

`package.json` `exports` exposes only `"."` unless the spec names a subpath (e.g. `@tessera/schema/json-schema`).

Register the package in `pnpm-workspace.yaml` (already `packages/*`), root `tsconfig` references, and Turbo `tasks` as needed.

## 8. When you are stuck

1. Re-read the invariant table in the relevant spec. Pick the option that keeps every `INV-*` true.
2. Prefer the smaller change.
3. Do not invent product behavior. Append `docs/questions.md` using its template and implement the conservative option behind a named constant.
4. Never widen a type or loosen a schema to “make it compile.”

## 9. Done means

Walk `AGENTS.md §5` line by line. If any box is unchecked, the PR is not ready.
