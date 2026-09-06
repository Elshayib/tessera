# 17 — Roadmap

Status: Accepted · Last updated: 2026-09-06

Effort estimates assume one part-time maintainer (~10 h/week) directing AI agents that do most of the implementation. Each phase ends with something usable and a tagged milestone. A phase does not exit until its exit criteria are demonstrated and its tests, docs and evals are green.

| Phase | Milestone | Goal | Effort | Exit criteria |
| --- | --- | --- | --- | --- |
| 0 | `m0-foundations` | Repo, toolchain, `std`, `schema` v0.1, `core` (document, command bus, undo, queries), `testing`, headless CLI validate | 2–3 weeks | `tessera validate` runs on fixture documents; property tests for commands/undo pass; CI green with all gates; ADRs 0001–0016 accepted |
| 1 | `m1-composition-editor` | Web editor: viewport (WebGPU/WebGL2), primitives, glTF import, PBR materials, lights, cameras, HDRI environment (Poly Haven), gizmos, outliner, inspector, projects in IndexedDB/OPFS, `.tessera` archive, glTF + sidecar export, Three.js code export | 6–8 weeks | Compose R1-class scene by hand; export opens correctly in Godot 4 and Blender 5; visual baselines established; budgets met on baseline hardware |
| 2 | `m2-agent-v1` | Provider settings (all built-in LLM providers), key vault, capability probing, chat panel, tool derivation, plan/act/verify loop with spatial checks and vision critic, review panel, per-run undo, transcripts and traces, macros (`layout.*`, `camera.fit`), `core-20` evals in replay with 2 providers, R3F code export | 5–7 weeks | `core-20` ≥ 90% hard-assertion pass in replay for two providers; a non-technical tester completes 3 scripted tasks by prompt alone |
| 3 | `m3-assets` | Asset panel, Poly Haven textures/HDRIs/models, Kenney manifest, uploads UX, thumbnails, generation providers (Meshy, Tripo, Rodin, HF TRELLIS.2, local worker contract + reference Dockerfile), job UI, KTX2/Draco options, attribution export | 4–6 weeks | Agent furnishes a room from CC0 props and generates one custom prop end-to-end (replay + live smoke) |
| 4 | `m4-engine-bridges` | Sidecar v1 frozen, Godot addon, Unity package, Unreal script, Blender import/export add-on, engine conversion tables + shared test vectors, docs for each | 4–6 weeks | The same export lands in Godot and Unity with lights, colliders, tags and names intact; Godot addon tests run in CI |
| 5 | `m5-mcp-desktop` | `@tessera/mcp` in-editor server, `apps/mcp-server` pipe, Tauri desktop with files, keychain vault, loopback proxy, Ollama/LM Studio discovery, client auto-config, signed updates | 3–5 weeks | Claude Code (subscription, no API key) builds a `core-20` scene in the editor; desktop installs on three OSes |
| 6 | `m6-collaboration` | y-webrtc rooms, share links, presence, per-author undo UI, locks, conflicts panel, blob exchange, Hocuspocus server with persistence and roles, agents visible as participants | 5–8 weeks | Two browsers and one agent edit the same scene without invariant violations; server room deployed from the Docker image |
| 7 | `m7-depth` | CSG (manifold), parametric modifiers (extrude, lathe, bevel, array, mirror), procedural geometry scripts, behaviors with engine stub export, keyframe timeline, physics preview (Rapier), headless Blender jobs (remesh, decimate, UV, bake), auto-instancing | 8–12+ weeks | A game-ready prop and a scripted level are produced from a single prompt session and exported to Godot |
| 8 | `m8-community` | External plugin loading (npm), docs site with API reference, templates and gallery, eval leaderboard publication, contributor onboarding, 1.0 API freeze | ongoing | First external plugin (a provider or exporter) published by someone outside the core team; 1.0 tagged |

## Cross-phase tracks

| Track | Always on |
| --- | --- |
| Quality | Every phase adds tests, benchmarks and evals; coverage thresholds never drop |
| Docs | Specs updated with code; package READMEs; ADRs for decisions |
| Security | Threat model reviewed at each phase exit; dependency audit green |
| Performance | Budgets checked on baseline hardware before each milestone tag |
| Accessibility | Keyboard-only walk-through at each milestone |

## Definition of 1.0

A user with no 3D background produces a game-ready level in Godot from a conversation; a developer with Claude Code does the same from the terminal; both work with at least three different model providers with `core-20` ≥ 90% and the extended suites ≥ 75%; the public API, sidecar format and MCP surface are frozen with a documented deprecation policy; the desktop app auto-updates on three OSes; at least one external plugin exists.

## Dependencies between phases

```
0 → 1 → 2 → 3 → 4
          ↘ 5 (needs 2)      6 (needs 2; benefits from 3)      7 (needs 1–3)      8 (needs 5–7)
```
Phases 3, 4 and 5 can proceed in parallel by different agents once phase 2 is stable; phase 6 and 7 can overlap after 3.
