# Tessera

**An open-source, browser-first, agent-native 3D scene workspace.**
Describe what you want; a model of your choice edits a real, undoable scene document; refine by hand or by prompt; export to Godot, Unity, Unreal or Blender. Humans and agents work in the same file at the same time.

> Status: **pre-alpha — specification complete, implementation starting.**
> Everything in `docs/` is normative. Code is written to the specs, not the other way around.

## Why Tessera

| Existing tools | Tessera |
| --- | --- |
| Spline V2: polished, closed, its own models, MCP only from a desktop app | Open source, any model (bring your own key, local models, or your Claude Code / Codex subscription through MCP) |
| Mixar: Blender fork, expert UX, desktop only, closed AI backend | Browser-first, no backend at all, chat-first UX that non-experts can use |
| Engine MCP servers (Blender / Unity / Godot): agents drive a host editor | A workspace designed around agents: reviewable transactions, per-author undo, closed-loop verification, evals |
| Web-export focused tools | Game-engine output as the primary target: glTF + sidecar, with native bridges for Godot, Unity, Unreal and Blender |
| Single-player editors | CRDT document from day one; agents are collaborators with presence, ownership and attribution |

## Principles

1. **One mutation path.** Every change — from the UI, the built-in agent, an external MCP client or a remote collaborator — goes through the same validated command bus. No exceptions.
2. **Document-first.** The scene is data (entities, components, assets). Code is an escape hatch attached to the document, never the source of truth.
3. **Model-agnostic by construction.** Interfaces for language models and generation models are separate packages from their implementations. Nothing in the editor knows which vendor is behind a model.
4. **Local-first, zero backend.** Keys, projects and assets live on the user's machine. Every hosted component has a self-hosted or peer-to-peer alternative.
5. **Engine-agnostic output.** glTF 2.0 is the interchange; a sidecar carries what glTF cannot. Bridges turn exports into native scenes.
6. **Built for agents, by agents, to a professional bar.** Strict types, schemas as the single source of truth, tests before code, performance budgets, and an eval suite that measures the agent itself.

## Repository map

```
docs/            Normative specifications, ADRs, task tickets, config templates (start at docs/README.md)
apps/            web (editor), desktop (Tauri), cli, mcp-server, collab-server, docs site      [phase 0+]
packages/        @tessera/* libraries: std, schema, core, spatial, engine, agent, providers, ... [phase 0+]
bridges/         godot-addon, unity-package, unreal, blender-addon (GPL-3.0)                    [phase 4+]
evals/           Agent evaluation suites, runner and reports                                    [phase 2+]
```

## Working on Tessera

- Humans: read [`CONTRIBUTING.md`](CONTRIBUTING.md).
- AI agents: read [`AGENTS.md`](AGENTS.md), then [`docs/18-implementation-playbook.md`](docs/18-implementation-playbook.md), then the next `todo` ticket in [`docs/tasks/phase-0.md`](docs/tasks/phase-0.md) (**T-0001**).
- Headless validate: `pnpm tessera validate <path>` (snapshot JSON or a folder containing `project.tessera.json`).

## Languages

TypeScript (strict) for the editor, document, agent, protocol servers and tooling. Rust for the desktop shell and, when profiling justifies it, WASM kernels. WGSL (through three.js TSL) on the GPU. Python, GDScript and C# appear only inside engine bridges where the host dictates the language. Rationale: [`docs/adr/ADR-0001-languages.md`](docs/adr/ADR-0001-languages.md).

## License

MIT for everything in this repository except `bridges/blender-addon`, which is GPL-3.0-or-later because Blender add-ons must be GPL-compatible. See [`LICENSE`](LICENSE) and [`docs/adr/ADR-0011-licensing.md`](docs/adr/ADR-0011-licensing.md).
