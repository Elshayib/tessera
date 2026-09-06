# AGENTS.md — operating manual for AI agents working on Tessera

You are implementing a professional product from written specifications. You are not prototyping. Read this file completely before touching anything.

## 1. Read order (do not skip)

1. `docs/README.md` — index and document status legend.
2. `docs/18-implementation-playbook.md` — how to implement without inventing.
3. `docs/00-vision.md` — what Tessera is and is not.
4. `docs/01-engineering-standards.md` — the quality bar. Every rule in it is enforced in CI or review.
5. `docs/02-architecture.md` — packages, layers, dependency rules, data flow.
6. `docs/glossary.md` — the exact words to use. Use them exactly.
7. The specification for the area you are working in (`docs/03` … `docs/16`).
8. Your ticket in `docs/tasks/phase-N.md`. The ticket is the scope; the spec is the truth.
9. The `README.md` of every package you will touch (once it exists).

If a ticket and a spec disagree, the spec wins. Record the disagreement in `docs/questions.md` (see §7).

## 2. Work protocol for a ticket

1. **Claim.** Check the ticket's `Depends on` list; every dependency must be `done`. If not, stop and pick another ticket.
2. **Read.** Read the ticket, the linked spec sections and the files listed under `Touches`. Do not read the entire repository.
3. **Plan.** Write a 5–10 line plan as the first comment of your PR description: files to add or change, interfaces you will implement, tests you will write.
4. **Tests first.** Write the tests listed in the ticket's `Tests` section (they should fail). Add tests for every acceptance criterion.
5. **Implement.** Make the tests pass. Stay inside the ticket's `Touches` list; if you must touch something else, say why in the PR.
6. **Gates.** Run, in this order, and fix everything: `pnpm typecheck`, `pnpm lint`, `pnpm depcruise`, `pnpm knip`, `pnpm test`, and `pnpm test:e2e` when the ticket says so. Never skip, disable, or `.skip` a test to get green.
7. **Docs.** Update the package `README.md`, TSDoc on public exports, and the spec if you discovered a real gap (mark the change clearly). Add a changeset (`pnpm changeset`) for any package change.
8. **Self-review.** Walk the Definition of Done (§5) line by line before opening the PR. Fill in the PR template completely.

Size discipline: a ticket is one PR. If the ticket is too big for one PR of ≤ 600 changed lines (excluding tests and generated files), split it and record the split in the ticket file.

## 3. Commands (available after ticket T-0001 lands)

```
pnpm install                 # exact versions from the lockfile
pnpm dev                     # runs apps/web with hot reload
pnpm build                   # builds every package and app
pnpm typecheck               # tsc -b across the workspace
pnpm lint                    # biome check
pnpm lint:fix                # biome check --write
pnpm depcruise               # dependency-cruiser: layer and cycle rules
pnpm knip                    # unused files, exports and dependencies
pnpm test                    # vitest, all packages, with coverage thresholds
pnpm test:e2e                # playwright, apps/web
pnpm eval:replay             # agent evals against recorded provider fixtures (deterministic)
pnpm changeset               # record a versioned change
```

Node ≥ 24 LTS and pnpm ≥ 10 via Corepack (`corepack enable`). Rust stable is required only for `apps/desktop`.

## 4. Hard rules (violations fail review)

Never:
- Use `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error` (the last is allowed only in a test that documents a compile-time guarantee), or non-null assertions `!` outside tests.
- Mutate the document except through a command executed by the command bus (`docs/04-command-bus.md`). No direct `Y.Map.set` outside `@tessera/core`.
- Import across layers against the rules in `docs/02-architecture.md §5`. `dependency-cruiser` enforces this; do not edit its config to get green.
- Import a vendor SDK (`ai`, `@ai-sdk/*`, `@modelcontextprotocol/sdk`, `three`, `yjs`) from a package that the architecture does not allow to know about it.
- Add a dependency without an entry in the PR's "New dependencies" section (name, license, size, why no existing dependency works). Copyleft licenses require an ADR.
- Use `console.*`. Use the `Logger` from `@tessera/std` (injected through your package's factory).
- Leave `TODO`/`FIXME` without a ticket id (`TODO(T-0123): …`).
- Use default exports (exception: React `lazy()` route modules in `apps/*`).
- Write tests that hit the network, depend on time, or depend on ordering. Use fixtures from `@tessera/testing`.
- Commit secrets, API keys, or `.env` files. The repository has no backend and needs none.
- Change a public interface listed in a spec without updating the spec in the same PR.

Always:
- Named exports, `import type` for types, ESM only, `kebab-case.ts` file names, one concept per file.
- Errors in layer 0–2 packages (`std`, `schema`, `core`, `spatial`, `storage`, `agent`, `exporters`, providers, …) are returned as `Result<T, E>` from `@tessera/std` (see `docs/01 §6`). Throwing is reserved for programmer errors (violated invariants) via `invariant()`.
- Every public function and type has TSDoc with at least one `@example` when non-trivial.
- Every package has `README.md` with: purpose, public API summary, dependency rules, how to test.
- Every unit of behavior has a test next to it: `foo.ts` → `foo.test.ts`.
- Performance-sensitive code (anything in the render loop, document sync, or describe-scene) has a benchmark or a budget assertion (`docs/01 §8`).

## 5. Definition of Done (copy into the PR and tick every line)

- [ ] All acceptance criteria in the ticket are covered by tests that pass.
- [ ] `pnpm typecheck && pnpm lint && pnpm depcruise && pnpm knip && pnpm test` pass locally.
- [ ] No new `any`, casts, ignores, or `console.*` (grep before pushing).
- [ ] Public API has TSDoc; package `README.md` updated.
- [ ] Spec updated if behavior or interfaces changed; ADR added if a decision was made.
- [ ] Changeset added.
- [ ] Coverage thresholds for touched packages hold (`docs/01 §7`).
- [ ] Bundle size budget holds for `apps/web` when it is touched.
- [ ] PR description contains: plan, summary, screenshots or recordings for UI, "New dependencies" section (or "none").
- [ ] Ticket status updated in `docs/tasks/phase-N.md` (`todo` → `in-progress` → `done`, with PR link).

## 6. Conventions that prevent the usual mistakes

- **Words.** "Document" is the data. "Scene" is the three.js runtime object graph. "Entity" is a node in the document. "Object3D" is its runtime mirror. Never say "object" when you mean entity.
- **Ids.** Entities `e_…`, assets `a_…`, behaviors `b_…`, transactions `t_…`, agent runs `r_…`, jobs `j_…`. Ids are opaque; names are for humans and models.
- **Units.** Meters, Y-up, right-handed, rotations as Euler degrees XYZ in the document. Light units are physical (lux, candela, nits). Never convert silently; conversions live in exporters.
- **Async.** No floating promises (`void` them explicitly only in fire-and-forget event handlers with a comment). Use `AbortSignal` on every long-running API.
- **State.** Document state lives in the Yjs document. UI-only state (selection, hover, panel layout, camera) lives in the UI store and is never persisted into the document.
- **Feature flags.** New user-visible behavior lands behind a flag in `apps/web/src/flags.ts` until the ticket that "turns it on" is done.
- **Generated code.** Files under `**/generated/**` are produced by scripts; never edit by hand; regenerate and commit.

## 7. When the spec is silent or ambiguous

1. Prefer the option that preserves an invariant listed in the relevant spec.
2. Prefer the smaller change.
3. Do not invent product behavior. Append an entry to `docs/questions.md` using its template, reference it in your PR, and implement the conservative option behind a flag or with a clearly named constant.
4. Never resolve ambiguity by widening a type or loosening a schema.

## 8. Repository map

```
AGENTS.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md LICENSE README.md
docs/                     specifications (normative), adr/, tasks/, templates/, questions.md
apps/web                  the editor (React + three.js), static build
apps/desktop              Tauri shell (Rust) around apps/web + sidecar
apps/cli                  `tessera` CLI: validate, export, eval
apps/mcp-server           MCP stdio/HTTP entrypoint wrapping @tessera/mcp
apps/collab-server        optional y-websocket/Hocuspocus room server
apps/docs                 Astro Starlight documentation site
packages/std              Result, error codes, invariant, ids, Logger, Emitter, Clock, AbortSignal helpers, redact
packages/schema           Zod 4 schemas, types, migrations, JSON Schema generation, inspector metadata
packages/core             Yjs-backed document, command bus, transactions, undo, queries, jobs, registries
packages/spatial          bounds, overlap, ground snapping, layout solver (pure math, Node-safe)
packages/engine           three.js WebGPU sync layer, gizmos, picking, screenshots
packages/llm              LLM interfaces (no vendor code)
packages/providers-llm    AI SDK implementations of @tessera/llm
packages/generation       3D/texture generation interfaces and job model
packages/providers-generation  Meshy, Tripo, Rodin, Hugging Face, local adapters
packages/assets           asset sources (Poly Haven, Kenney, uploads), import pipeline
packages/storage          blob and project persistence (memory, IndexedDB, OPFS, filesystem)
packages/agent            agent runtime: loop, tools, tiers, roles, budgets, traces
packages/exporters        glTF + sidecar, code export, engine mappings
packages/mcp              MCP server exposing commands and queries
packages/collab           sync providers, awareness, locks
packages/ui               React panels and design system
packages/plugin-api       extension interfaces
packages/testing          fixtures, fakes, scene assertions
bridges/*                 engine-side importers
evals/                    agent evaluation suites and runner
```

## 9. Ticket format

Tickets live in `docs/tasks/phase-N.md` and follow `docs/templates/task-template.md`. Each has: id, phase, package, size, dependencies, goal, context links, deliverables, steps, acceptance criteria, tests, non-goals, status. Do not start a ticket that lacks acceptance criteria; ask for them via `docs/questions.md`.
