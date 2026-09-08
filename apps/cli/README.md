# `@tessera/cli`

Headless `tessera` CLI. `validate` and `export gltf` (`03` §12, `09`, `INV-ARCH-06`).

## Public API

| Export | Description |
| --- | --- |
| `runCli(argv)` | Runs `validate` or `export` and returns `{ exitCode, stdout, stderr }`. |
| `runExport(argv)` | `export gltf <path> --out <dir>`. |
| `tessera` (bin) | Process entry. |

Exit codes: `0` success; `2` validation or export errors; `1` I/O or usage.

## Dependency rules

Layer 4. May import `@tessera/schema`, `@tessera/exporters`, `@tessera/storage`, and Node built-ins. Must not import `three` (`INV-ARCH-06`).

## Usage example

```
pnpm tessera validate packages/schema/fixtures/documents/0.1.0/campfire.json
pnpm tessera export gltf packages/schema/fixtures/documents/0.1.0/campfire.json --out ./out
```

## Testing notes

Colocated Vitest tests. `src/cli.ts` is excluded from coverage (process entry).

## Related specs

- `docs/03-domain-model.md` §12
- `docs/09-export-and-bridges.md`
- `docs/02-architecture.md` INV-ARCH-06
- Tickets T-0009, T-0121
