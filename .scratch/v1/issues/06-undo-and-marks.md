## Parent

#1

## What to build

The Person can Undo the last Verb (and stack that), Mark a state they liked, and restore a Mark. First take is already a Mark.

## Acceptance criteria

- [ ] A test acting as the Person Undoes the last completed Verb; the Scene matches before that Verb.
- [ ] Undo stacks (two Undos walk back two Verbs).
- [ ] A Stopped Verb that never completed is not on the Undo stack.
- [ ] The Person can create a named Mark and restore it; the Scene matches that Mark.
- [ ] Restoring the automatic First-take Mark returns the First take.

## Blocked by

- #3
