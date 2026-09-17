# Tessera

Tessera is an agent-native 3D creation product: a person with no 3D skill types to Tessera's own agent and watches a Scene come into being. Tessera *is* the 3D software; it is not a layer on Blender or any other human DCC. Form is composed, then sculpted. No third-party generator is the source of form. v1 is a free installed app on Windows, open source under MIT. The Person owns their Work.

## Product

**Tessera**:
The product. An agent-native 3D tool that a person uses by talking, watching, and judging the result. v1 is a free installed app on Windows, licensed MIT. Mac and Linux are later; they must not require a rewrite.
_Avoid_: Blender wrapper, Blender MCP, plugin, add-on, proprietary (v1)

**Person**:
Someone using Tessera to get 3D made. They are not expected to operate a 3D viewport by hand. v1 is beginner-first: the core loop survives if they never touch the scene. Orbit and Point are optional, never required. v1 they type; they do not speak. They own their Work.
_Avoid_: user (when we mean this role), artist, operator, customer (the commercial relationship is separate)

**Work**:
The Scene, the Stills, the Turntable video, and later the Mesh. The Person owns it. Tessera claims no rights in it.
_Avoid_: output, generation, "AI content" (as a rights claim)

**Agent**:
Tessera's own 3D agent. It lives inside the product, owns the conversation and the system prompt, and is the only thing that operates the engine. A Person never has to wire an external coding agent to Tessera via MCP or an API to get work done. It Guesses and keeps moving, and Asks only when the next Verb would be hard to Undo.
_Avoid_: copilot, assistant, Claude, "the LLM"

**Engine**:
Tessera's 3D software: the scene, the operations, and the vocabulary. Designed so the Agent can do good work with a small set of operations, few tokens, and weaker models. Blender (and any other human DCC) never appears.
_Avoid_: backend, kernel, renderer (the renderer is one part of the Engine), Blender

**Key**:
A model API key the Person pastes into Tessera. v1: the Person brings the Key; Tessera does not host inference. A Key belongs to one Provider from a short list (the main paid APIs). The Verbs do not change when the Provider does.
_Avoid_: subscription (v1), Tessera-hosted model, local model (v1)

**Provider**:
A company whose model the Agent can think with, given a Key. v1 is a short list, not one lab and not every model on earth.
_Avoid_: backend, LLM vendor (when we mean this), "Claude" as the product

## What the Person sees

**Viewport**:
The live 3D view the Person watches while Verbs land. The product's primary surface. Chat and Narration exist so the Person does not lose the plot; they are not the product.
_Avoid_: preview, canvas, editor (when we mean this surface)

**Narration**:
The Agent saying, in the chat, what it is doing while the Viewport updates.
_Avoid_: logs, chain-of-thought, status bar

**Orbit**:
The Person turning the camera to judge the Scene. Optional. Never required to finish the loop. The Agent does not fight an Orbit in progress; it Frames again on the next Verb.
_Avoid_: gizmo, navigate, fly-through (v1)

**Point**:
The Person clicking an Object to mean "this." Optional, like Orbit. Words still work alone. Point is "I mean this," not a 3D skill.
_Avoid_: select, pick, gizmo, target

**Frame**:
The Agent putting the camera on the work, on every Verb, so the Person is looking at what just changed.
_Avoid_: camera shot, cinematography (v1)

**Turntable**:
A short orbit of the Scene so the Person can judge it as 3D, not as a picture. v1's delivered artifact. They may keep a short video of it to send to a friend. Not a Game-ready asset.
_Avoid_: render (when we mean this artifact), clip, export

**Still**:
A picture of the framed view. Something they may keep and send. Not the working document.
_Avoid_: screenshot (when we mean this keepable picture), render, export

**Game-ready asset**:
An object that exports and looks right in a game engine. The destination. Not v1's contract.
_Avoid_: FBX, GLB (when we mean the concept), production mesh

## The working document

**Scene**:
The working document. A place: Objects, ground, sky, light, camera — and the Talk, so tomorrow's Rehearsal still knows what "the roof" meant. In v1 the Scene lives as a file on the Person's machine. No account is required to make one.
_Avoid_: project, shot (the framed view is not the document), level, cloud document (v1)

**Talk**:
The conversation in this Scene: Intent, Narration, Steer. It lives with the Scene. Opening yesterday's Scene continues the Rehearsal; the chat is not gone.
_Avoid_: thread, history (when we mean this), prompt log

**Object**:
One thing in the Scene. The Agent addresses it as a whole: its place, its silhouette, its material family. The Agent gives it a name in Narration so the Person can say "the roof."
_Avoid_: mesh, model, actor, entity (when we mean this concept)

## How form is made

**Clay**:
How the Engine holds form. Pieces can be joined, carved, and inflated without talking about vertices. A Mesh is poured from Clay later, when a Game-ready asset is needed.
_Avoid_: SDF, voxel, mesh (as the native store), geometry buffer

**Mesh**:
A triangle surface a game engine understands. Not how the Engine stores a Scene.
_Avoid_: the Scene itself being a mesh

**Part**:
A named piece the Agent may place while Composing.
_Avoid_: asset, prefab, mesh, tile (except as the idea behind the name Tessera)

**Primitive**:
A Part with no identity beyond its shape: box, sphere, cylinder, capsule, cone, torus.
_Avoid_: mesh primitive, solid

**Kit**:
The shipped library of named Parts, in a few families: architecture, nature, props. It grows. It is not the product. It ships under the same MIT license as Tessera. Every Part in it must be MIT-clearable.
_Avoid_: asset pack, marketplace (v1), kitbash library, proprietary pack

**Compose**:
Building a readable structure by placing and combining Parts. The first phase of form. The First take is composed so the Person can already judge.
_Avoid_: generate, prompt-to-3D, kitbash (when we mean this phase)

**Sculpt**:
Working the silhouette of an Object — carve, inflate, taper, weather. The second phase of form. Still Object-level; never Vertex-level work.
_Avoid_: brush, ZBrush, displace (as Agent-facing ideas)

**First take**:
The first judgeable state of the Scene: readable silhouettes, light that matches the Intent, and Material families already on the Objects. Weathering and taste are Rehearsal. Not a blob. Not a finished picture. Always a Mark, so they can come back to it.
_Avoid_: draft, preview, generate, v0

**Mark**:
A named state of the Scene the Person asked to keep ("I liked it at dusk, before the extra windows"). They may restore a Mark. The First take is always a Mark.
_Avoid_: checkpoint, commit, save, version (as Person-facing words)

**Undo**:
Revert the last Verb. They can stack it. Undo is not a Mark: it does not name a whole take they liked.
_Avoid_: rewind, history slider (v1)

**Material family**:
A named look for a surface or the sky ("weathered oak", "brushed steel", "dusk sky"). Not a shader graph. The First take already wears these.
_Avoid_: shader, material graph, PBR setup (as Agent-facing ideas)

**Look**:
Tessera's house style: designed, not fake-photo. A Scene should read as made, not scanned.
_Avoid_: photoreal, photogrammetry, "unreal engine screenshot" (as the v1 target)

**Rehearsal**:
The Person talking at what they see on the same Scene: more Intent, more Verbs. Not a new Scene.
_Avoid_: iteration (when we mean this loop), revision, regenerate

## How the Agent works

**Verb**:
A named, high-leverage operation the Agent is allowed to issue against the Engine. Verbs are the Agent's entire surface. A small verb set is the design constraint that makes the loop cheap and fast.
_Avoid_: tool, command, Blender operator, Python API, function call (when we mean this concept)

**Scene-level verb**:
A Verb that acts on the scene as a whole (what is in it, how it is framed, how it is lit).
_Avoid_: global operator

**Object-level verb**:
A Verb that acts on one object in the scene as a whole (its silhouette, its material family, its place).
_Avoid_: mesh operator, modifier

**Intent**:
What the Person wants. Words, and they may drop one or more pictures (photo, sketch, screenshot). A picture is Intent, not a scan to copy. The Agent still Composes and Sculpts; a picture is never a back door into a third-party generator. The Person never names a Verb.
_Avoid_: prompt (when we mean the Person's request), query, instruction, image-to-3D

**Steer**:
The Person talking in while the Agent is working. The Agent finishes the current Verb, then takes the new Intent. "Not the roof — the door" while it is still on the roof.
_Avoid_: interrupt (when we mean this), cancel, regenerate

**Stop**:
The Person halting the current Verb. The Scene stays as it is. Then they talk. For "no, all of that is wrong."
_Avoid_: kill, abort (as Person-facing words)

**Guess**:
The Agent picking a meaning and acting. It always names the guess in Narration ("the roof" means the lantern roof). Default.
_Avoid_: assume (when we mean this), infer silently

**Ask**:
The Agent posing a question instead of acting, only when the next Verb would be hard to Undo: deleting, a big Sculpt, or two Objects that could match and Point was not used. The Viewport may wait. This is the exception, not the loop.
_Avoid_: confirm, dialog, form

## What the Agent does not speak

**Vertex-level work**:
Setting coordinates, moving individual vertices, or otherwise addressing geometry as points. Forbidden in the Agent's vocabulary.
_Avoid_: sculpt brush stroke (as an Agent-facing idea), "move this vertex"

**Shader graph**:
A network of material nodes. Forbidden in the Agent's vocabulary. Materials are named families, not graphs.
_Avoid_: node tree, shader nodes, Principled BSDF

**Topology, UVs, rigs**:
Internal Engine concerns if the Engine needs them. They are not first-class objects in the Agent's vocabulary.
_Avoid_: edge flow, UV island, armature (as Agent-facing ideas)
