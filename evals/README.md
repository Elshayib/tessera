# `@tessera/evals`

Headless agent evaluation runner (`docs/13-testing-and-evals.md` §5). Replay uses `ReplayLlmClient` and never calls model providers (`INV-TST-01`).

## Public API

| Export | Description |
| --- | --- |
| `parseEvalArgs` | CLI: `--suite`, `--model`, `--mode replay\|live`, `--judge`, `--report` |
| `runEvals` | Runs `EvalCase`s; replay does not write `evals/reports/leaderboard.md` |
| `isScoredPhase2` | `core-20` minus `needs-generation` (Q-0131) |
| `CORE_EVAL_CASES` | The 20 ids from `13` §5.4 |

## Commands

```
pnpm eval:replay
pnpm --filter @tessera/evals eval --mode replay --suite core
```

Live mode is for maintainers (`TESSERA_LIVE`); CI must not invoke it.

## Dependency rules

Layer 4. May import non-UI packages and `@tessera/testing`. Must not import `@tessera/ui`, `three`, or `ai`.

## Testing notes

`pnpm --filter @tessera/evals test`. Replay misses mention `TESSERA_RECORD=1`. Two-provider recordings are T-0215.

## Related specs

- `docs/13-testing-and-evals.md` §5
- Tickets T-0213, T-0215
