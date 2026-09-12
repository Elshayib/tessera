# Phase 3 assets check (replay + optional live smoke)

Manual procedure for the **m3-assets** exit: core-20 replay including `core.generate-barrel`, plus optional live smoke (`TESSERA_LIVE=1`) of “furnish a room from CC0 props + generate one custom prop” (`docs/17-roadmap.md`, `docs/13-testing-and-evals.md` §5.4).

Do **not** git-tag `m3-assets` from an agent. Kenney (T-0309) stays blocked on Q-0003.

## Replay (CI and maintainers)

From the repository root:

```
pnpm eval:replay -- --model openai/gpt-4o
pnpm eval:replay -- --model anthropic/claude-sonnet
```

`core.generate-barrel` is **scored** (Q-0182). Replay uses recorded LLM fixtures. The oracle commits a generated-provenance geometry via `asset.create` (same assertions as `13` §5.4) so replay hashes stay stable; `FakeGenerationProvider` covers the generation contract in unit tests (`@tessera/testing`). Replay must not call model or generation vendor networks (`INV-TST-01`).

### What “scored generate-barrel” means

Hard assertions from `13` §5.4: generated asset with provenance; entity near the wall; on ground. Mean hard score is over **all** core-20 ids.

## Live smoke (maintainers only)

Requires vendor keys. Not run in CI.

```
TESSERA_LIVE=1 pnpm eval -- --mode live --model <providerId>/<modelId>
```

Prompt: furnish a room from CC0 (Poly Haven) props and generate one custom prop. Confirm import/generate jobs show progress and cancel in the job panel.

## Human evidence checklist

- [ ] `pnpm eval:replay` twice, same scored outcome for `core.generate-barrel` (pass, not skipped)
- [ ] Optional live smoke attached when keys exist
- [ ] Confirm no git tag `m3-assets` was pushed without this evidence
