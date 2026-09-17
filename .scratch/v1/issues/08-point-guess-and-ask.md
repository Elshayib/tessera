## Parent

#1

## What to build

Words still work alone: the Agent Guesses and names the guess in Narration. Optional Point means “this.” The Agent Asks only when the next Verb would be hard to Undo: remove, a large Sculpt, or two Objects that could match and Point was not used.

## Acceptance criteria

- [ ] With one matching Object, “the roof” Guesses, Narration names the guess, and work continues (no Ask).
- [ ] A test acting as the Person Points at a named Object (standing in for a click); later “this” / the next Intent binds to it.
- [ ] Core loop still works with no Point.
- [ ] Two possible roofs and no Point → Ask, Viewport waits, no Verb lands until the Person answers.
- [ ] `remove` without Point → Ask. `remove` with that Object Pointed → acts.
- [ ] Ask is the exception, not the default.

## Blocked by

- #3
