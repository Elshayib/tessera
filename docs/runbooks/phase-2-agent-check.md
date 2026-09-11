# Phase 2 agent check (replay ≥ 90% and prompt-only tasks)

Manual procedure for the **m2-agent-v1** exit: core-20 replay hard-assertion pass ≥ 90% for two providers, plus a non-technical tester completing three scripted tasks by prompt alone (`docs/17-roadmap.md`, `docs/13-testing-and-evals.md` §5.2 / §5.4).

Do **not** git-tag `m2-agent-v1` and do **not** mark phase 2 complete until a human attaches evidence (this runbook’s checklist).

## Replay (CI and maintainers)

From the repository root:

```
pnpm eval:replay -- --model openai/gpt-4o
pnpm eval:replay -- --model anthropic/claude-sonnet
```

Recordings live at `evals/fixtures/recordings/<providerId>/core/<case>.<modelId>.json` (`13` §4). Replay must not call model or asset provider networks (`INV-TST-01`). Refresh fixtures locally with `TESSERA_RECORD=1` (or `pnpm --filter @tessera/evals record:oracle` for the committed oracle scripts).

### What “90%” means

`hardScore` per scored case is passed assertion weight / total weight (`13` §5.2). The suite mean is the mean of scored cases. `core.generate-barrel` is tagged `needs-generation` and is **not** scored until phase 3 (Q-0131). Phase 2 exit is mean ≥ **0.90** for **each** of the two provider ids `openai` and `anthropic` (`07` §4, `INV-TST-02`).

## Three scripted prompt-only tasks

In Settings, save a BYOK key and set the executor (and optionally planner) to `providerId/modelId` (for example `openai/gpt-4o`). Then use only these prompts from `13` §5.4. Do not invent capabilities.

1. "Add a red cube 1 m on each side at the origin."
2. "Create a table with four chairs around it."
3. "Describe the scene."

A non-technical tester should complete each in the chat panel with no manual viewport modeling. Attach notes or a recording to the evidence PR.

## Human evidence checklist

- [ ] `pnpm eval:replay -- --model openai/gpt-4o` mean ≥ 90%
- [ ] `pnpm eval:replay -- --model anthropic/claude-sonnet` mean ≥ 90%
- [ ] Prompt-only task 1 (red cube)
- [ ] Prompt-only task 2 (table and chairs)
- [ ] Prompt-only task 3 (describe the scene)
- [ ] Confirm no git tag `m2-agent-v1` was pushed without this evidence

## Evidence status

Replay fixtures are committed for the oracle client (deterministic tool scripts). They are **not** live-provider recordings. The three prompt-only tasks still need a human tester. Do **not** git-tag `m2-agent-v1` and do **not** mark the roadmap phase 2 row complete until that evidence is attached.
