# Config and document templates

Ticket **T-0001** copies the toolchain files in this folder into the repository root (and `.github/`) **verbatim**, then fills versions. Do not invent a different toolchain.

| File | Destination after T-0001 |
| --- | --- |
| `package.root.json` | `/package.json` |
| `pnpm-workspace.yaml` | `/pnpm-workspace.yaml` |
| `npmrc` | `/.npmrc` |
| `nvmrc` | `/.nvmrc` |
| `tsconfig.base.json` | `/tsconfig.base.json` |
| `tsconfig.json` | `/tsconfig.json` |
| `turbo.json` | `/turbo.json` |
| `biome.json` | `/biome.json` |
| `dependency-cruiser.cjs` | `/.dependency-cruiser.cjs` |
| `knip.json` | `/knip.json` |
| `vitest.workspace.ts` | `/vitest.workspace.ts` |
| `lefthook.yml` | `/lefthook.yml` |
| `renovate.json` | `/renovate.json` |
| `ci.yml` | `/.github/workflows/ci.yml` |
| `changeset-config.json` | `/.changeset/config.json` |
| `adr-template.md` | (stay here; copy when writing an ADR) |
| `task-template.md` | (stay here; copy when splitting a ticket) |

Document templates (`adr-template.md`, `task-template.md`) are never moved.
