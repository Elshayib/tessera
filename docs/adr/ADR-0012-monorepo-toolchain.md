# ADR-0012 — Monorepo toolchain

Status: Accepted · Date: 2026-09-06

## Context
~20 packages and 6 apps sharing types must build, test and lint consistently with minimal configuration surface — important when many agents edit the repo.

## Decision
pnpm workspaces + Turborepo (task graph, local cache) · `tsc -b` with project references for libraries · Vite for apps · Biome for lint+format · dependency-cruiser for layer rules · knip for dead code · Vitest (Node + browser mode) · Playwright · Changesets · lefthook · Renovate · size-limit · license allowlist check. Templates in `docs/templates/`.

## Alternatives
- Nx: more features, more configuration and opinion; Turborepo is sufficient.
- ESLint + Prettier: more plugins, two tools, slower; Biome covers the needed rules (import restrictions are handled by dependency-cruiser).
- Bundling libraries with tsup/tsdown: unnecessary for internal packages consumed by Vite; `tsc -b` keeps type checking and emit aligned.
- Bun as runtime/package manager: attractive speed; not adopted yet because of Node ecosystem parity risks in Playwright/Tauri tooling. Revisit yearly.

## Consequences
- One command set for everyone (`AGENTS.md §3`).
- Toolchain changes require updating templates and this ADR.
