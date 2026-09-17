## Parent

#1

## What to build

The Person pastes a Key and picks a Provider from Anthropic, OpenAI, and Google. A bad Key shows an error they can act on. They can change Key or Provider without losing the open Scene. The Key lives in app settings, never in the Scene file. Tests never call a live lab (fake HTTP / scripted Provider).

## Acceptance criteria

- [ ] The Person can set a Key and choose Anthropic, OpenAI, or Google.
- [ ] Verbs and the Verb contract do not change across Providers.
- [ ] Missing, invalid, or out-of-credit Key surfaces an actionable error; the Viewport is not a silent freeze.
- [ ] Changing Key or Provider leaves the open Scene intact.
- [ ] Key is stored on the machine, not in a Scene file.
- [ ] Tests do not hit live Provider networks.

## Blocked by

- #2
