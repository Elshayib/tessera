## Parent

#1

## What to build

While the Agent is working, the Person can Steer (talk over: current Verb finishes, then the new Intent is taken) or Stop (current Verb dies; Scene stays at the last completed Verb).

## Acceptance criteria

- [ ] A test acting as the Person Steers during a multi-Verb Rehearsal; the current Verb completes, then the new Intent runs.
- [ ] A test acting as the Person Stops; the in-flight Verb does not land; the Scene matches the last completed Verb.
- [ ] After Stop, the Person can talk again from that state.

## Blocked by

- #6
