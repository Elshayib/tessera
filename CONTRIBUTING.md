# Contributing to Tessera

Tessera is built to a professional bar by a small number of humans and a large number of AI agents. The rules below apply to both. AI agents must additionally follow `AGENTS.md`.

## Setup

1. Install Node ≥ 24 LTS and enable Corepack: `corepack enable` (provides pnpm ≥ 10).
2. `pnpm install` — the lockfile is authoritative; never `--no-frozen-lockfile` in CI.
3. `pnpm dev` starts the editor at `http://localhost:5173`.
4. Optional: Rust stable for `apps/desktop`; Godot 4.4+, Unity 6, Unreal 5.7+, Blender 5.x for bridges.

## Branches and commits

- Branch names: `feat/T-0123-short-description`, `fix/T-0456-…`, `docs/…`, `chore/…`.
- Commits follow Conventional Commits: `feat(core): add transaction labels`, `fix(engine): dispose textures on asset removal`. Scope is the package or app name.
- One ticket per PR. Keep PRs ≤ 600 changed lines excluding tests and generated code.

## Pull requests

- Fill in the template completely. PRs without the plan, the Definition of Done checklist and the "New dependencies" section are returned without review.
- CI must be green: typecheck, lint, dependency rules, unused-code check, unit tests with coverage thresholds, e2e when `apps/web` changes, bundle size budget.
- Every PR gets one review. Reviewers use the checklist in `docs/01-engineering-standards.md §11`.

## Specs, ADRs and RFCs

- `docs/*.md` are normative. Behavior changes require a spec change in the same PR.
- Decisions with lasting consequences (a new dependency with a copyleft license, a schema change, a new package, a change to a public interface) require an ADR in `docs/adr/` using the template. ADRs are numbered sequentially and never deleted; superseded ADRs are marked as such.
- Large proposals (new subsystem, new phase scope) start as an RFC issue using the RFC template before any code.

## Issue labels

`phase:N`, `pkg:<name>`, `type:task|bug|rfc|question`, `size:S|M|L`, `good-first-ticket`, `blocked`, `needs-spec`.

## Code of conduct

See `CODE_OF_CONDUCT.md`. Be direct, be kind, assume competence.
