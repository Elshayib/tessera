# 00 — Vision, scope and non-goals

Status: Accepted · Last updated: 2026-09-06

## 1. What Tessera is

Tessera is an open-source, browser-first, agent-native 3D scene workspace. A user (or an external coding agent) describes what they want; a language model of the user's choice edits a real, undoable scene document through a validated command interface; the user refines by hand or by prompt; the result exports to game engines and 3D tools as native scenes.

It is a **workspace**, not a modeling package and not a game engine. It composes: it places, arranges, lights, textures, animates and scripts scenes built from primitives, imported assets, library assets and generated assets. Depth features (booleans, parametric modifiers, retopology, UVs, baking) arrive by integrating specialized kernels and tools, never by re-implementing Blender.

## 2. Who it is for

| Persona | Needs | What Tessera gives them |
| --- | --- | --- |
| Solo game developer | Blockouts, prop placement, lighting, quick levels for Godot/Unity/Unreal | Prompt-driven composition, engine-native export with colliders and names intact |
| Designer / non-coder | 3D scenes without learning Blender | Chat-first UX, review-and-undo, library and generated assets |
| Developer with a coding agent | Drive a 3D tool from Claude Code / Cursor / Codex like any other tool | MCP server with the same command surface as the UI, on their existing subscription |
| Team | Several people and agents on one scene | CRDT document, presence, per-author undo, attribution |
| Researcher / tinkerer | Compare models on 3D tasks; self-host everything | Provider abstraction, eval suite and leaderboard, zero-backend architecture |

## 3. Differentiators (in priority order)

1. **Open and model-agnostic.** MIT code, no backend, any LLM (cloud BYOK, local, or a subscription via MCP), any generation provider.
2. **Agent quality.** Closed-loop plan → act → verify → repair with vision and physics checks; reviewable transactions; per-author undo; a public eval suite.
3. **Integrated asset acquisition.** CC0 libraries first, generation second, all with license and provenance tracked on every asset.
4. **Collaboration with agents as participants.** Presence, ownership locks, attribution, background jobs.
5. **Engine output.** glTF + sidecar with bridges that produce native Godot, Unity, Unreal and Blender scenes.

## 4. Product pillars → technical commitments

| Pillar | Commitment |
| --- | --- |
| Trust | Every change is a transaction with an author, a label and a structured diff. Nothing is applied that cannot be undone in one step. |
| Speed | 60 fps target in the viewport for reference scenes; sub-second agent tool round-trips; incremental everything. |
| Portability | Runs in current browsers with WebGPU, falls back to WebGL2; desktop shell adds files, local models, MCP. |
| Openness | Specs, ADRs, evals and roadmap are public. Interfaces are documented for plugin authors from day one. |
| Privacy | Keys and projects never leave the machine unless the user connects a sync room or a provider. |

## 5. Non-goals (through 1.0)

- Not a polygon-level modeling or sculpting tool. Mesh editing is limited to parametric operations (CSG, extrude, lathe, bevel, arrays) and delegated jobs.
- Not a game engine runtime. Behaviors are authored and previewed, then exported as engine-native stubs; Tessera does not ship games.
- Not a hosted SaaS. There is no Tessera account. Optional self-hosted services (sync room server, generation worker) are provided as containers.
- Not a marketplace. Asset sources are integrations; Tessera does not sell or host assets.
- Not a film renderer. Path tracing and offline rendering are out of scope; screenshots and previews use the real-time renderer.

## 6. Competitive positioning (September 2026)

| | Spline V2 | Mixar | Bezi | Engine MCP servers | Tessera |
| --- | --- | --- | --- | --- | --- |
| Open source | No | App yes (GPL), backend no | No | Mostly | Yes (MIT) |
| Runs in browser | Yes | No | No | No | Yes |
| Model choice | Spline's | BYOK / OpenRouter / Codex | Vendor's | Any MCP client | Any provider, local, or MCP client |
| External agents | Desktop MCP only | In-app agent | — | Yes | Web bridge + desktop MCP |
| Collaboration | Yes | No | No | No | Yes (CRDT) |
| Primary output | Web exports | Blender formats | Unity project | Host format | glTF + native engine bridges |
| Asset provenance / license tracking | — | — | — | — | Yes, per asset |

## 7. Success criteria per phase

Defined in `17-roadmap.md`. The one that matters most for 1.0: a user with no 3D background produces a game-ready level in Godot from a conversation, and a developer with Claude Code does the same from their terminal, using different models, with the same result quality measured by the eval suite.
