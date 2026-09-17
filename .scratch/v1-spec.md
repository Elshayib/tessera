## Problem Statement

A Person who has no 3D skill cannot make stunning 3D for games, films, or anything else. Today's tools (Blender, ZBrush, and the rest) are built for trained operators. They are slow to learn and slow to use. Agents already drive those tools, but the Agent then inherits a human UI: it spends tokens on *how* instead of *what*, and the Person still stares at software they cannot operate.

The Person wants to type what they want, watch it come into being, talk at what they see, and leave with something they can show and come back to — with no gizmos required, and without wiring an external coding agent through MCP.

## Solution

Tessera is a free, MIT-licensed, installed Windows app that *is* the 3D software. The Person pastes a Key for a Provider, types Intent (and may drop pictures), and watches a live Viewport.

The Agent Composes a Scene from Primitives and a small Kit, then Sculpts silhouettes. It speaks only Verbs: scene-level and object-level. It never speaks vertices, shader graphs, topology, UVs, or rigs. Form is Clay, not a Mesh. v1 delivers a judgeable First take, then Rehearsal on the same Scene, and the Person leaves with the Scene file, a Still, and a short Turntable video.

The Viewport is the product. Chat and Narration exist so the Person does not lose the plot. Orbit and Point are optional. Tests act as the Person: they do not issue Verbs, open a real window, or call a live Provider.

## User Stories

1. As a Person, I want to install Tessera on Windows and run it without creating an account, so that I can start without a signup wall.
2. As a Person, I want Tessera to be free, so that the only bill I already have is my Provider Key.
3. As a Person, I want to paste a Key for a Provider from a short list, so that the Agent can think without Tessera hosting a model.
4. As a Person, I want to pick among the main paid Providers, so that I am not married to one lab.
5. As a Person, I want the Verbs to stay the same when I change Provider, so that Tessera is the product, not a skin of one model.
6. As a Person, I want my Key stored on my machine and never written into a Scene file, so that I can send a Scene to a friend without leaking the Key.
7. As a Person, I want to type Intent in a chat, so that I can work without a microphone.
8. As a Person, I want to drop one or more pictures with my words (photo, sketch, screenshot), so that I can show silhouette, paint, and time of day when I cannot describe them.
9. As a Person, I want those pictures treated as Intent, not as a scan to copy, so that Tessera does not secretly wrap an image-to-3D generator.
10. As a Person, I want to type “a weathered lighthouse on a cliff at dusk” and watch a Scene appear, so that I do not have to operate 3D software.
11. As a Person, I want the first thing I see to already be a readable place — lighthouse-shape on cliff-shape, lit like dusk, wearing named looks — so that I can judge it instead of art-directing a blob.
12. As a Person, I want that First take automatically marked, so that I can always come back to the first judgeable state.
13. As a Person, I want to watch the Viewport while Verbs land, so that I see the Agent working, not a spinner then a result.
14. As a Person, I want Narration in the chat that says what the Agent is doing, so that I do not lose the plot (“why did it flatten the roof?”).
15. As a Person, I want the Agent to Frame the camera on every Verb, so that I am looking at what just changed.
16. As a Person, I want to Orbit the Scene if I choose, so that I can judge the other side.
17. As a Person, I want the Agent not to fight an Orbit in progress, so that the camera does not snatch away while I am looking.
18. As a Person, I want the Agent to Frame again on the next Verb after I Orbit, so that I am put back on the work without being stuck on a bad angle I chose by accident.
19. As a Person, I want the core loop to work if I never Orbit and never Point, so that “no skill” is true, not a brochure.
20. As a Person, I want to Point by clicking an Object to mean “this,” so that “that one” does not become an argument.
21. As a Person, I want the Agent to name Objects in Narration (“the lantern roof”), so that I can say “the roof” in words alone.
22. As a Person, I want to Rehearse on the same Scene (“the roof is too steep,” “more wind-beaten,” “not dusk enough”), so that making 3D is a conversation, not a lottery.
23. As a Person, I want to Steer while the Agent is working: I talk, it finishes the current Verb, then it takes the new Intent, so that I can say “not the roof — the door” without waiting for a full take.
24. As a Person, I want to Stop the current Verb, so that a long step I already hate does not have to finish.
25. As a Person, I want Stop to leave the Scene as it is, so that I can talk from a known state.
26. As a Person, I want to Undo the last Verb, and stack that, so that a small mistake is cheap.
27. As a Person, I want to Mark a state I liked (“I liked it at dusk, before the extra windows”), so that Rehearsal stays brave.
28. As a Person, I want to restore a Mark, so that one bad request cannot destroy a Scene I loved.
29. As a Person, I want the Talk saved in the Scene file, so that tomorrow I still know what “the roof” meant.
30. As a Person, I want to close Tessera, open yesterday’s Scene, and continue the Rehearsal, so that a Scene is a session I return to, not a disposable chat.
31. As a Person, I want a new Scene to start empty of Talk and Clay, so that a fresh Intent is a fresh place.
32. As a Person, I want to keep a Still of the framed view, so that I can send a picture to a friend.
33. As a Person, I want to keep a short Turntable video, so that I can send 3D as motion without a game engine.
34. As a Person, I want the Scene file itself as the working document, so that I can reopen and keep working.
35. As a Person, I want to own the Scene, the Still, the Turntable video, and later any Mesh, so that Tessera does not claim my Work.
36. As a Person, I want Tessera not to upload my Scene or Talk anywhere to operate, so that a local file and a Key are enough.
37. As a Person, I want the Agent to Guess and name the guess in Narration when I say “the roof,” so that the Viewport keeps moving.
38. As a Person, I want the Agent to Ask instead of acting when the next Verb would be hard to Undo (delete, a big Sculpt, two Objects that could match and I did not Point), so that “the other roof” does not ruin a Mark I did not know I needed.
39. As a Person, I want Ask to be the exception, so that Tessera feels like watching work, not filling a form.
40. As a Person, I want the Scene to look designed, not like a fake photograph, so that Tessera has a house Look and does not compete with scan-to-3D sites on their terms.
41. As a Person, I want dusk (and other named lighting) to be a Scene-level Verb, so that “at dusk” is something I can judge on the First take.
42. As a Person, I want Objects to wear Material families on the First take (rock, painted wood, dusk sky), so that I can say “wrong lighthouse” and “not dusk enough” immediately.
43. As a Person, I want weathering and taste to be Rehearsal, not a requirement of the First take, so that the first 30 seconds stay watchable.
44. As a Person, I want the Agent to Compose from Primitives and a small Kit (architecture, nature, props), so that a lighthouse is made of lighthouse-shaped pieces, not twelve cylinders.
45. As a Person, I want the Agent to Sculpt after Compose (carve, inflate, taper, weather), so that a cliff can look grown, not only assembled.
46. As a Person, I never want to name a Verb, so that I talk in Intent, not in engine language.
47. As a Person, I never want to set a vertex, edit a shader graph, or hear about topology, UVs, or rigs, so that “no skill” includes “no 3D vocabulary.”
48. As a Person, I want a weak or cheaper model on my Key to still produce a readable First take, so that Tessera’s Verbs — not the largest model — are doing the work.
49. As a Person, I want to see an error I can act on if the Key is missing, invalid, or out of credit, so that a dead brain is not a frozen Viewport with no explanation.
50. As a Person, I want to change Provider or Key without losing the open Scene, so that billing trouble is not a lost lighthouse.
51. As a Person, I want MIT-licensed Tessera, so that I can read, fork, and share the Engine, the Verbs, the app, and the Kit.
52. As a Person, I want every Kit Part to be MIT-clearable, so that using the Kit does not put a foreign license on my Work.
53. As a Person, I want one Scene on screen at a time, so that v1 is a conversation with a place, not an IDE of many files.
54. As a Person who received a Still or a Turntable video, I want to understand the place without installing Tessera, so that sharing does not require the app.
55. As a Person, I want Mesh export to be absent in v1, so that the Engine is not blocked on Game-ready topology.
56. As the Agent, I want a small named Verb set, so that I can do good work with few tokens.
57. As the Agent, I want to place, join, and cut Parts as whole Objects, so that Compose is cheap.
58. As the Agent, I want to wear a Material family on an Object, so that I never build a shader graph.
59. As the Agent, I want to light the Scene and set the sky as named conditions, so that dusk is one Verb.
60. As the Agent, I want to Frame on the Object I just changed, so that the Person is looking at the work.
61. As the Agent, I want to carve, inflate, taper, and weather an Object as a whole, so that Sculpt is Intent-level.
62. As the Agent, I want to name an Object, so that Talk can bind “the roof.”
63. As the Agent, I want to remove an Object only after Ask unless the Person Pointed at it, so that delete is not a silent Guess.
64. As a test acting as the Person, I want to drive Tessera without a real window, so that the suite runs headless.
65. As a test acting as the Person, I want a scripted Provider, so that I never call a live lab and never pay per test.
66. As a test acting as the Person, I want to assert First take, Narration, Guess, Ask, Steer, Stop, Undo, Mark, restore, save/open Talk, Still, and Turntable, so that the product loop is locked down from the outside.

## Implementation Decisions

- The published module is **Session**: Tessera as the Person meets it. Callers (the real UI, and tests) submit Intent, Steer, Stop, Point, Orbit, Undo, Mark, Restore, save/open Scene, keep Still, keep Turntable video, and set Key/Provider. Callers do not issue Verbs.
- **Provider** is a real seam under Session: production adapters for a short list of paid APIs; a scripted adapter for tests. The scripted adapter returns planned Verbs or an Ask. It never hits the network.
- **View** is a real seam under Session: the live Viewport in the app; a recorder in tests. Tests assert Frame, Narration, and that a Still or Turntable was produced. They do not open a GPU window.
- The **Engine** sits behind Session. Its interface is the Verb set. Product tests do not cross that interface. The Engine may have its own tests through Verbs (internal seam) for Clay, Undo, and Marks.
- Clay is stored as signed distance fields. The Viewport shows Clay directly (raymarch). A Mesh is not stored. Mesh extraction is out of v1.
- v1 ships as an installed Windows app. The Engine must stay portable enough that Mac (then Linux) is not a rewrite. No browser product in v1. No cloud Engine. No account.
- The Scene is a file on disk. It round-trips Clay, Objects (names, Parts, material families, place), light, sky, camera, Talk (Intent, pictures, Narration, Steer), and Marks. It does not contain the Key.
- Key and Provider choice live in app settings on the machine.
- v1 Providers: Anthropic, OpenAI, Google. Adding a Provider must not change Verbs or the system prompt’s Verb contract.
- The Person types. No voice in v1.
- Pictures attached to Intent are stored with the Talk in the Scene. They condition the Agent. They must not invoke an image-to-3D generator.
- **First take bar** (the Agent must reach this before yielding): readable silhouettes of the named place; light matching Intent; Material families on Objects and sky; a Frame on the work; Narration of what was done and what names mean; an automatic Mark named First take. Weathering and taste are Rehearsal.
- **Guess vs Ask**: Guess by default; always name the guess in Narration. Ask only if the next Verb is remove, a large Sculpt, or resolving “the roof” (or similar) to two or more Objects when Point was not used. After Ask, the Viewport may wait.
- **Steer**: finish the current Verb, then treat the new text as Intent on the same Scene.
- **Stop**: abandon the current Verb; Scene remains the last completed Verb; then the Person talks.
- **Undo**: revert the last completed Verb; stackable. Stopped work that never completed is not on the Undo stack. Restore Mark is not Undo.
- **Mark**: Person-named snapshot of Scene+Talk-at-that-state. First take is always a Mark. Restore replaces the current Scene with that snapshot (and should itself be undoable as a Verb-sized step, or recorded so the Person can return).
- **Point**: binds “this” to an Object. In the app, a click in the Viewport. In tests, the Person-adapter Points at a named Object (the name the Agent already gave), standing in for the click that would have hit it.
- **Orbit**: Person-controlled camera while active. Agent does not Frame until the next Verb after Orbit ends.
- **Look**: designed, not photoreal. Material families are named looks, not PBR graphs (`weathered oak`, `painted wood`, `rock`, `brushed steel`, `dusk sky`, and a small set like them).
- **Primitives**: box, sphere, cylinder, capsule, cone, torus.
- **Kit families** (small, MIT-clearable): architecture, nature, props. Minimum to Compose the lighthouse example: tower, lantern room, doorway, window bay, roof cap; cliff slab, rock, ground; railing, lamp. The Kit is not the product; it may grow later. No Keep-as-Part in v1.
- **Verb set** (the Agent’s entire surface in v1). No other Verbs. No coordinates, no vertex lists, no shader nodes in arguments:

  **Scene-level**
  - `light` — named condition matching Intent (`dusk`, `noon`, `overcast`, `night`, `dawn`).
  - `sky` — named Material family for the environment.
  - `frame` — camera on a named Object or on the Scene.

  **Compose**
  - `place` — create an Object from a Primitive or Kit Part, with a name, at a relative place (`on the cliff`, `atop the tower`, `beside the door`). The Engine resolves place; the Agent does not pass vertices.
  - `join` — union two named Objects into one named Object.
  - `cut` — subtract one named Object from another.
  - `remove` — delete a named Object. Triggers Ask unless that Object is Pointed.

  **Look**
  - `wear` — set a Material family on a named Object.

  **Sculpt**
  - `carve` — cut into the silhouette of a named Object (amount as a coarse word: `a little`, `more`, `a lot`; region as a whole-object side: `windward`, `top`, `base`, not a brush stroke).
  - `inflate` — push the silhouette out, same coarse arguments.
  - `taper` — narrow or widen along the Object’s own up/along.
  - `weather` — wear the silhouette as if by age or wind. Rehearsal, not First take.

  **Talk-binding**
  - `name` — set the name used in Narration and later Intent.

- System prompt and Verb descriptions are owned by Tessera, not by the Provider. They must stay small enough that a weaker model can Compose a First take.
- One Person, one Scene on screen in v1. No live sharing.
- GPU is required. No phone/web target in v1.
- License: MIT for Engine, Verbs, app, and Kit. Third-party packs with a different license do not ship in the Kit.
- Tests act as the Person. They must not issue Verbs, open a real window, or call a live Provider.

## Testing Decisions

- A good test asserts what a Person can notice: First take contents (named Objects, light, material families, automatic Mark), Narration text, Guess naming, Ask vs action, Steer (current Verb finishes, then new Intent), Stop (Scene frozen at last completed Verb), Undo, Mark/restore, Scene file round-trip including Talk, Still produced, Turntable video produced, Key errors, pictures treated as Intent (scripted Provider receives them; no generator invoked), core loop without Point or Orbit, Point binding “this,” Orbit not fought then re-Framed.
- Tests do not assert SDF internals, GPU pixels, shader code, token counts, or Provider HTTP.
- The module under product test is Session, through the Person interface, with a scripted Provider and a recording View.
- Engine-internal tests (optional, not a second product surface) may issue Verbs to lock Clay booleans, Sculpt, Undo stack, and Marks. They still must not leak vertices into the Verb interface.
- There is no prior art in this repo. There is no application code yet. First tests establish the Session seam.

## Out of Scope

- Game-ready Mesh export, topology, UVs, rigs, animation.
- Voice.
- Shipping Mac or Linux in v1 (portability of the Engine is in scope; installers are not).
- Browser app, WebGPU product, cloud Engine, streamed Viewport.
- Accounts, galleries, hosted inference, OAuth to a Provider subscription, local models.
- Image-to-3D generators, Blender, or any human DCC as a backend.
- Vertex-level work, shader graphs, Keep-as-Part, Kit marketplace.
- Live collaboration, multiple Scenes on screen, phone.
- Paid app, hostage export, Tessera claiming rights in Work.
- Photoreal / scan Look as a v1 target.

## Further Notes

- Glossary and decisions: `CONTEXT.md` and `docs/adr/` (0001–0020). Use those words in code, tests, and UI copy. Do not invent synonyms.
- Tracer for the First take: “a weathered lighthouse on a cliff at dusk.” If that Intent does not yield a judgeable place under a scripted Provider, the product is not standing.
- Next split (`/to-tickets`) should keep Session as the test surface per ticket. Do not open a ticket whose tests speak Verbs unless it is explicitly an Engine-internal ticket behind Session.
