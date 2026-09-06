# T-XXXX — <short imperative title>

| Field | Value |
| --- | --- |
| Phase | 0 |
| Package | `@tessera/<name>` or `apps/<name>` or `repo` |
| Size | S (≤ 200 loc) · M (≤ 400) · L (≤ 600) excluding tests |
| Depends on | T-0000 (`done`) |
| Status | `todo` |

## Goal

One sentence. What is true when this ticket is done that is not true now?

## Context

- Spec: `docs/0X-….md` §…
- ADR: `docs/adr/ADR-….md` (if any)
- Playbook: `docs/18-implementation-playbook.md`

## Touches

Exact paths this PR may create or edit. Anything else needs a note in the PR.

```
packages/<name>/package.json
packages/<name>/tsconfig.json
packages/<name>/README.md
packages/<name>/src/index.ts
packages/<name>/src/<concept>.ts
packages/<name>/src/<concept>.test.ts
```

## Deliverables

- [ ] Public API listed in the package README
- [ ] Tests listed below, all passing
- [ ] Changeset (`pnpm changeset`)
- [ ] Spec `Last updated` bumped if behavior was clarified

## Steps

1. Write the tests in `Tests` so they fail.
2. Implement the interfaces from the spec as written (do not rename).
3. Run the gates in `AGENTS.md §3`.
4. Fill the PR template.

## Acceptance criteria

1. …
2. …

Every criterion has a test. A criterion without a test is incomplete.

## Tests

| Test name (must include invariant id when relevant) | File |
| --- | --- |
| `'INV-… …'` | `src/….test.ts` |

## Non-goals

What this ticket must **not** do (no extra features, no drive-by refactors).

## Notes for the implementing agent

Constraints, gotchas, forbidden shortcuts.
