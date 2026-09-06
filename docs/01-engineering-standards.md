# 01 — Engineering standards

Status: Accepted · Last updated: 2026-09-06 · Enforced by: CI (`docs/templates/ci.yml`), lint configs, review checklist (§11)

This document defines the quality bar. It is deliberately strict: most of the code will be written by AI agents of varying strength, and strict, mechanically checked rules are what make that safe.

## 1. Languages and runtimes

| Layer | Language | Rule |
| --- | --- | --- |
| Editor, document, agent, protocol servers, exporters, CLI, tooling | **TypeScript** (strict, ESM) | Default for everything. No JavaScript files except generated output. |
| Desktop shell | **Rust** (stable) via Tauri 2 | Only in `apps/desktop/src-tauri`. Keep the shell thin: windows, filesystem, keychain, process spawning, MCP transport. |
| Performance kernels | **Rust → WASM** | Only after a benchmark in CI shows a TypeScript implementation misses its budget (§8). Prefer an existing WASM library (manifold-3d, xatlas, meshoptimizer, Rapier) over a new crate. New crates require an ADR. |
| GPU | **WGSL via three.js TSL** | Never hand-write GLSL; TSL compiles to WGSL and GLSL for the fallback. |
| Bridges | GDScript (Godot), C# (Unity), Python (Unreal remote execution, Blender add-on) | Only inside `bridges/*`; dictated by the host. |
| Scripts, CI | TypeScript executed with `tsx`; YAML for GitHub Actions | No Bash/PowerShell beyond one-liners; scripts must run on Windows, macOS and Linux. |

Rationale: `adr/ADR-0001-languages.md`. Summary: the hot paths of a browser 3D editor are the GPU and the engine's internals, not the application language; TypeScript maximizes ecosystem fit (three.js, AI SDK, MCP SDK, Yjs, gltf-transform) and is the language LLM agents produce most reliably; Rust is reserved for the places where it measurably pays.

Runtime versions: Node ≥ 24 LTS (`.nvmrc` / `engines`), pnpm ≥ 10 via Corepack, TypeScript ≥ 5.9 (move to the native compiler when the ecosystem — Vite, Vitest, Biome — supports it end to end), Rust stable (pinned in `rust-toolchain.toml`). Exact versions are pinned in `package.json`; upgrades arrive through Renovate PRs (§13).

## 2. Toolchain

| Concern | Tool | Notes |
| --- | --- | --- |
| Package manager / workspaces | pnpm workspaces | `pnpm-workspace.yaml`; strict peer deps; `shamefully-hoist=false` |
| Task orchestration | Turborepo | Remote cache disabled by default (no vendor account); local cache on |
| Library builds | `tsc -b` (project references) | Libraries emit ESM + `.d.ts` to `dist/`; no bundler for libraries |
| App builds | Vite | `apps/web`, `apps/desktop` (frontend), `apps/docs` (Astro) |
| Lint + format | Biome | One tool, one config (`biome.json`); Prettier and ESLint are not used |
| Dependency rules | dependency-cruiser | `.dependency-cruiser.cjs` encodes `02-architecture.md §5`; violations fail CI |
| Dead code | knip | Unused files, exports, dependencies fail CI |
| Unit / integration tests | Vitest | Node environment by default; browser mode (Playwright provider) for `@tessera/engine` and `@tessera/ui` |
| E2E and visual tests | Playwright | Chromium required; WebKit and Firefox nightly, non-blocking |
| Benchmarks | Vitest `bench` | Thresholds in `*.bench.ts`; see §8 |
| Versioning | Changesets | Independent semver per package; changelog generated |
| Git hooks | lefthook | pre-commit: biome on staged files; pre-push: typecheck + unit tests of affected packages |
| Dependency updates | Renovate | Weekly, grouped, auto-merge for patch updates of dev dependencies only |
| Bundle size | size-limit | Budgets in `apps/web/.size-limit.json` |
| License compliance | license-checker (allowlist) | Runs in CI; see §13 |

Config templates for all of the above live in `docs/templates/`; ticket T-0001 copies them into place.

## 3. TypeScript configuration

`tsconfig.base.json` (template in `docs/templates/`) is extended by every package. Non-negotiable flags:

```
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"noPropertyAccessFromIndexSignature": true,
"useUnknownInCatchVariables": true,
"verbatimModuleSyntax": true,
"isolatedModules": true,
"module": "NodeNext", "moduleResolution": "NodeNext", "target": "ES2023",
"lib": ["ES2023", "DOM", "DOM.Iterable"]   // DOM only in browser-facing packages
```

Rules:
- No `any`. `unknown` at boundaries, narrowed with Zod or type guards.
- No type assertions (`as`) except `as const` and in tests. If you need `as`, the type is wrong; fix the type.
- No non-null assertions (`!`). Use explicit checks and return a `Result` or throw an invariant error.
- No enums; use `as const` objects and union types.
- Prefer `readonly` on all interface properties and `ReadonlyArray`/`ReadonlyMap` in public APIs. Mutation happens inside the command bus only.
- Public API types are named and exported; no anonymous object types in exported signatures.
- Discriminated unions for variants (`kind` field), exhaustive `switch` with `assertNever`.

## 4. Code organization

- One concept per file; file name is the concept in `kebab-case.ts` (`command-bus.ts`, `renderer-sync.ts`).
- Tests are colocated: `command-bus.test.ts`; benchmarks `command-bus.bench.ts`; browser-mode tests `*.browser.test.ts`.
- Each package has exactly one public entry `src/index.ts` that re-exports the public API explicitly (no `export *`). Deep imports across packages are forbidden (`@tessera/core/src/...`); `exports` in `package.json` exposes only `.` (and documented sub-paths such as `@tessera/schema/json-schema`).
- Internal modules that must be shared across a package's files but not exported live under `src/internal/`.
- Generated code lives under `src/generated/` with a header comment naming the generator script; never hand-edited.
- Package layout:

```
packages/<name>/
  package.json        name @tessera/<name>, type: module, exports, sideEffects: false
  README.md           purpose, public API, dependency rules, testing notes
  tsconfig.json       extends ../../tsconfig.base.json; references
  src/index.ts
  src/**/*.ts
  src/**/*.test.ts
```

## 5. Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `fractional-index.ts` |
| Types, interfaces, classes | PascalCase, no `I` prefix | `CommandBus`, `EntityId` |
| Functions, variables | camelCase, verbs for functions | `applyTransaction`, `entityCount` |
| Constants | camelCase for values, UPPER_SNAKE only for true compile-time constants | `defaultCameraFov`, `MAX_ENTITIES` |
| Zod schemas | PascalCase + `Schema` suffix; inferred type without suffix | `TransformSchema`, `Transform` |
| Command names | `noun.verb` in camelCase, dot-separated namespaces | `entity.create`, `transform.set`, `layout.placeOn` |
| Query names | `noun.verb` | `scene.describe`, `entity.get` |
| Tool names (LLM) | same string as the command or query they wrap | `transform.set` |
| Events | `noun.pastTense` | `transaction.committed` |
| Log events | `pkg.subsystem.event` snake_case | `core.command_bus.rejected` |
| Ids | prefixed | `e_…`, `a_…`, `b_…`, `t_…`, `r_…`, `j_…` |
| Feature flags | `camelCase` in `flags.ts` | `agentVerifyLoop` |
| CSS / Tailwind | utility classes; design tokens via CSS variables `--t-…` | `--t-color-accent` |

Never abbreviate domain words (`transform`, not `xform`; `entity`, not `ent`). Acronyms are capitalized as words: `GltfExporter`, `McpServer`, `LlmClient`.

## 6. Error handling

- Packages at layers 0–2 (see `02-architecture.md §4`) return `Result<T, E>` from any operation that can fail for a reason the caller may handle: validation, not-found, conflict, provider errors, I/O, cancellation.
- Throw only for programmer errors (violated invariants, impossible states). Use `invariant(condition, message)` from `@tessera/std`; it throws `InvariantError`. Tests assert on these.
- The `Result` type and error shape are defined once in `@tessera/std`:

```ts
export type Result<T, E extends TesseraError = TesseraError> = Ok<T> | Err<E>;
export interface Ok<T> { readonly ok: true; readonly value: T; }
export interface Err<E> { readonly ok: false; readonly error: E; }
export interface TesseraError {
  readonly code: ErrorCode;
  readonly message: string;                    // human-readable, no secrets
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}
export type ErrorCode =
  | 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'INVARIANT_VIOLATION'
  | 'PERMISSION_DENIED' | 'UNSUPPORTED' | 'CANCELLED' | 'TIMEOUT'
  | 'PROVIDER_ERROR' | 'IO_ERROR' | 'BUDGET_EXCEEDED' | 'RATE_LIMITED';
```

- Never swallow errors. Either handle, return, or log at `error` level with the event name and rethrow/return.
- UI (layer 3) converts `Err` into user-facing messages through a single `describeError(error)` function with i18n keys; never show raw messages from providers.
- All async APIs that can run longer than 100 ms accept an `AbortSignal` and return `CANCELLED` when aborted.

## 7. Testing standards

Test pyramid and required coverage (lines and branches, enforced by Vitest thresholds per package):

| Package | Unit | Integration | Browser-mode | E2E | Coverage |
| --- | --- | --- | --- | --- | --- |
| std, schema | yes | — | — | — | 95% |
| core, spatial, exporters | yes | yes (document round-trips) | — | — | 90% |
| agent, llm, generation, assets, storage, mcp, collab | yes | yes (fakes) | — | — | 85% |
| engine | yes (pure parts) | — | yes | — | 70% |
| ui | yes (logic) | — | yes (panels) | via apps/web | 70% |
| apps/web | — | — | — | yes (Playwright) | smoke suite |

Rules:
- Tests are deterministic: no network, no wall clock (`Clock` interface injected), no randomness without a seeded generator, no test ordering dependencies. Fixtures and fakes come from `@tessera/testing`.
- Every invariant `INV-xx` in a spec has at least one test that references it by id in the test name.
- Every bug fix adds a regression test named after the issue.
- Provider integrations are tested against **recorded fixtures**; live tests exist but are opt-in (`TESSERA_LIVE=1`) and never run in CI.
- Visual regression: Playwright screenshots of reference scenes with a 0.2% pixel tolerance; baselines per browser engine in `apps/web/e2e/__screenshots__/`.
- Agent evals (`13-testing-and-evals.md`) run in replay mode on every PR touching `packages/agent`, `packages/schema`, or `packages/spatial`.
- Flaky tests are quarantined within 24 hours (marked `.todo` with a ticket) and fixed within the phase; a quarantined test blocks the phase exit.

## 8. Performance budgets

Reference scenes (fixtures in `@tessera/testing`):
- **R1** — 1,000 unique meshes, ~200k triangles, 8 punctual lights, 30 materials, one HDRI.
- **R2** — 10,000 instances of 20 meshes (instancing path), 4 lights.
- **R3** — 5 million triangles across 200 meshes (stress).
- **D1** — document with 10,000 entities and 2,000 assets (data-only).

Baseline hardware: Apple M1 (8 GB) and a Windows laptop with GTX 1650-class GPU; Chrome stable.

| Metric | Budget | How enforced |
| --- | --- | --- |
| Web app cold load to interactive (empty project, cable) | ≤ 2.5 s | Playwright trace in CI, Lighthouse monthly |
| Initial JS (gz) | ≤ 350 KB; engine chunk lazy ≤ 900 KB; total for empty project ≤ 1.5 MB | size-limit in CI |
| Viewport frame time | R1 ≥ 60 fps, R2 ≥ 60 fps, R3 ≥ 30 fps on baseline | Playwright perf run, manual before release |
| Primitive command (D1) | ≤ 0.5 ms p95 | Vitest bench threshold |
| Transaction of 100 commands (D1) | ≤ 16 ms | Vitest bench threshold |
| Undo / redo (D1) | ≤ 16 ms | Vitest bench threshold |
| Renderer sync, change set of 100 entities (R1) | ≤ 8 ms | Browser-mode bench |
| Full scene rebuild from document (R1) | ≤ 500 ms | Browser-mode bench |
| `scene.describe` (D1, default detail) | ≤ 20 ms, ≤ 8 KB output | Vitest bench + size assertion |
| glTF import, 50 MB | main thread never blocked > 50 ms; done ≤ 10 s | Playwright long-task observer |
| Autosave latency after commit | ≤ 200 ms | Integration test with fake clock |
| Tool round-trip excluding model latency | ≤ 50 ms p95 | Agent integration bench |
| Screenshot 1024×576 | ≤ 100 ms | Browser-mode bench |
| Memory (R1) | ≤ 500 MB JS heap; no growth > 5% over 100 create/delete cycles | Browser-mode leak test |

Any PR that regresses a budgeted metric by more than 10% fails CI. Budgets can only be loosened by an ADR.

## 9. Accessibility and UX standards

- All panels meet WCAG 2.2 AA: keyboard operable, visible focus, 4.5:1 contrast, labels on every control, `prefers-reduced-motion` respected, no information conveyed by color alone.
- The viewport `<canvas>` is `aria-hidden`; the outliner is the accessible representation of the scene. Transform nudging by keyboard (arrow keys with modifiers) is required in phase 1.
- All user-facing strings live in `packages/ui/src/messages/en.ts` keyed by id; no hardcoded strings in JSX. English is the source language; translations are a post-1.0 concern but the plumbing exists from phase 1.
- Every destructive action is undoable; the UI never asks "Are you sure?" for undoable actions.
- Agent output is never applied silently: the review panel shows the change set for each transaction, and the last agent transaction is always one keystroke from reverted.
- Error messages state what happened and what the user can do; they never show stack traces or provider payloads.

## 10. Security baseline

Full model in `14-security-threat-model.md`. Baseline rules enforced everywhere:
- Strict CSP for `apps/web` (`default-src 'self'`; provider origins are added at runtime through a service worker allowlist derived from the user's configured providers).
- No `eval`, no `new Function`, no `innerHTML` with untrusted data. Sandboxed scripts run only in the isolated interpreter (`12-plugin-system.md §6`).
- Secrets never enter logs, change sets, documents, exports or traces. `@tessera/std` `redact()` is applied to every log field.
- Dependencies: exact versions, `pnpm audit` high/critical blocks CI, no `postinstall` scripts without review, provenance attestations when publishing.

## 11. Code review checklist

Reviewers (human or agent) check, in order:
1. Does the PR do exactly what the ticket says, no more? Are non-goals respected?
2. Do tests cover every acceptance criterion and referenced invariant? Would the tests fail if the feature were removed?
3. Any `any`, cast, ignore, non-null assertion, `console.*`, hardcoded UI string, floating promise, missing `AbortSignal`?
4. Dependency rules: does `pnpm depcruise` pass without config changes? Any new dependency justified?
5. Public API: named types, TSDoc with examples, README updated, spec updated?
6. Errors: returned as `Result` where required; no swallowed errors; user-facing messages via `describeError`.
7. Performance: anything in a hot path? Bench or budget assertion present?
8. Security: untrusted input validated at the boundary? Secrets handled through the vault?
9. Accessibility for UI changes: keyboard path, labels, focus order, reduced motion.
10. Changeset present and semver-correct (breaking → major while pre-1.0 is minor; see `16`).

## 12. Documentation standards

- Every exported symbol has TSDoc: one-sentence summary, `@param`/`@returns` where non-obvious, `@example` for anything with more than one parameter or with side effects, `@remarks` for invariants it relies on.
- Stability tags on public APIs: `@public` (semver-protected), `@beta` (may change in minor), `@internal` (stripped from `.d.ts` via `stripInternal`).
- Package `README.md` sections in order: Purpose · Public API (table) · Dependency rules · Usage example · Testing notes · Related specs.
- Spec changes are made in the same PR as the code and summarized in the PR. The spec's `Last updated` line is bumped.
- ADRs use `docs/templates/adr-template.md` (MADR-style). Numbering is sequential; ADRs are immutable once accepted except for the `Status` line.

## 13. Dependency policy

Allowed licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, CC0-1.0, Zlib, BlueOak-1.0.0. MPL-2.0 and LGPL only for isolated, dynamically linked/WASM modules after an ADR. GPL/AGPL forbidden outside `bridges/blender-addon`.

A new dependency must: be actively maintained (release or commit in the last 12 months), ship types, be ESM-compatible, have no open high/critical advisories, and have no install scripts (or have them reviewed). The PR must state the minified+gzipped size for browser-facing packages and why the standard library or an existing dependency is insufficient.

Pinned exact versions in `package.json`; Renovate opens weekly grouped PRs; majors are separate PRs that require a ticket. `pnpm-lock.yaml` is committed and authoritative.

## 14. Git and CI

- Default branch `main`, protected: PR required, one approval, all required checks green, linear history (squash merge), no force pushes.
- Required checks: `typecheck`, `lint` (biome + depcruise + knip), `unit` (with coverage thresholds), `build`, `e2e-chromium`, `size`, `licenses`, `audit`, `evals-replay` (path-filtered).
- Commit messages follow Conventional Commits (validated by a hook). The squash commit title is the PR title.
- `main` is always releasable: the web app deploys from `main` to the preview channel on every merge and to stable on tags.

## 15. Feature flags and incremental delivery

- Unfinished user-visible behavior ships behind a flag in `apps/web/src/flags.ts` (typed object, default off, overridable via `?flag=name` in dev and via Settings → Experimental in production).
- A ticket that completes a feature includes "turn on flag X" and deletes the flag within the same phase. Flags older than one phase fail a lint script.

## 16. Logging

- `Logger` interface from `@tessera/std`: `debug|info|warn|error(event: string, fields?: Record<string, unknown>)`. Event names are `pkg.subsystem.event` in snake_case; fields are structured, never interpolated into the event name.
- Default sinks: console (dev), in-memory ring buffer (10,000 entries) exportable from Settings → Diagnostics, optional file sink in the desktop app.
- Never log secrets, full prompts, or asset payloads; log ids and sizes. Prompts and model outputs are stored in agent traces (`15-observability.md`), which are local and user-exportable.

## 17. Browser and platform support

| Platform | Support | Notes |
| --- | --- | --- |
| Chrome / Edge ≥ 128 (desktop) | Full | WebGPU |
| Safari ≥ 26 (macOS, iPadOS) | Full | WebGPU |
| Firefox ≥ 141 (desktop) | Full where WebGPU is enabled, otherwise Fallback | WebGL2 fallback path |
| Any browser without WebGPU | Fallback | WebGL2: no compute, ≤ 8 dynamic lights, TSL still used |
| Mobile browsers | View-only | Editing controls disabled; presence and viewing work |
| Desktop app | Windows 10+, macOS 13+, Ubuntu 22.04+ | Tauri 2 |

Detection and fallback behavior are specified in `05-rendering.md §3`.

## 18. Definition of Done

See `AGENTS.md §5`. It is the same list for humans.
