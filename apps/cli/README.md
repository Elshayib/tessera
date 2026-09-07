# `@tessera/cli`

Headless `tessera` CLI. Phase 0 exposes `validate` only (`03` §12, `INV-ARCH-06`).

## Public API

| Export | Description |
| --- | --- |
| `runCli(argv)` | Runs `validate <path>` and returns `{ exitCode, stdout, stderr }`. |
| `tessera` (bin) | `tessera validate <path>` — snapshot JSON or a folder with `project.tessera.json`. |

Exit codes: `0` if `ValidationReport.ok`; `2` if level 1–3 errors; `1` on I/O or usage. stdout is the report as JSON (Q-0024).

## Dependency rules

Layer 4. May import `@tessera/schema` and Node built-ins. Must not import `three` (`INV-ARCH-06`). Must not import `@tessera/core` for validate (snapshot JSON only).

## Usage example

```ts
import { runCli } from "@tessera/cli";

const result = runCli(["validate", "project.tessera.json"]);
```

```
pnpm tessera validate packages/schema/fixtures/documents/0.1.0/campfire.json
```

## Testing notes

Colocated Vitest tests. Coverage ≥ 95% lines on `validate.ts`.

## Related specs

- `docs/03-domain-model.md` §12
- `docs/02-architecture.md` §4, INV-ARCH-06
- Ticket T-0009
