## Ticket

T-____ — <title> (link to `docs/tasks/phase-N.md#t-____`)

## Plan (written before implementation)

- Files / packages touched:
- Interfaces implemented or changed:
- Tests written:

## Summary of changes

<!-- What changed and why. Link spec sections. -->

## Screenshots / recordings

<!-- Required for any UI change. -->

### Phase 1 export check (T-0122)

When this PR is the human evidence for `m1-composition-editor`, attach Godot 4 and Blender 5 screenshots per [`docs/runbooks/phase-1-export-check.md`](../docs/runbooks/phase-1-export-check.md). Do not tag the milestone without them.

- [ ] Godot 4.x scene tree (node names)
- [ ] Blender 5.x outliner (object names)


## New dependencies

<!-- For each: name, version, license, size (minified gz), why no existing dependency works. Write "none" otherwise. -->

## Definition of Done

- [ ] All acceptance criteria in the ticket are covered by tests that pass.
- [ ] `pnpm typecheck && pnpm lint && pnpm depcruise && pnpm knip && pnpm test` pass locally.
- [ ] No new `any`, casts, ignores, or `console.*`.
- [ ] Public API has TSDoc; package `README.md` updated.
- [ ] Spec updated if behavior or interfaces changed; ADR added if a decision was made.
- [ ] Changeset added.
- [ ] Coverage thresholds for touched packages hold.
- [ ] Bundle size budget holds (if `apps/web` touched).
- [ ] Ticket status updated in `docs/tasks/`.

## Open questions

<!-- Entries you added to docs/questions.md, if any. -->
