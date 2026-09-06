# ADR-0016 — Agent changes apply live in reviewable run groups

Status: Accepted · Date: 2026-09-06

## Context
Two review models exist: **live apply** (changes appear as the agent works; user reverts if unhappy) and **propose-then-apply** (changes computed on a fork; user accepts a diff). Live apply gives immediate visual feedback and lets the agent verify with screenshots of the real scene; propose-then-apply avoids transient states but delays feedback and complicates verification.

## Decision
v1 applies live: each step is a transaction tagged with the `runId`; the review panel shows the run's merged change set; **Revert run** undoes everything in one keystroke; per-step revert is available. A `dryRun` policy (forked `Y.Doc`, merged on accept) is specified as an optional mode behind a flag for later.

## Alternatives
- Propose-then-apply only: rejected for v1 (verification needs the real scene; slower iteration).
- Live apply without grouping: rejected (undo would be per command, unusable).

## Consequences
- Requires per-run undo (`ADR-0004`) and stable attribution in presence (collaborators see agent edits live).
- Transient intermediate states are visible; the UI marks the scene "agent working" and shows the plan.
