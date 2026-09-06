# ADR-0001 — Languages: TypeScript-first, Rust where it pays, WGSL via TSL

Status: Accepted · Date: 2026-09-06 · Deciders: project owner

## Context

The product is a browser-first 3D editor with an embedded agent, an MCP server, exporters, a desktop shell and collaboration. Requirements that drive the language choice:

1. **Runtime performance** where users feel it: viewport frame rate, document operations on large scenes, import of large files, agent tool latency.
2. **Ecosystem fit**: three.js (WebGPU renderer, TSL), Yjs (CRDT), gltf-transform, the AI SDK (multi-provider LLM access), the MCP SDK, Tauri, React — all TypeScript-first.
3. **Implementation by AI agents of varying strength**: the language must be one where models produce correct code most reliably and where static tooling catches the rest.
4. **A single codebase across browser, desktop and CLI.**

Where does time actually go in a browser 3D editor? GPU work (shaders, fill rate, draw submission) and the engine's internal scene traversal dominate frame time; CPU-bound hot spots are localized (mesh processing, BVH construction, layout solving, CRDT merging of huge updates). The application layer (UI, document, orchestration, agent loop) is I/O- and event-bound and does not benefit from a systems language.

## Decision

| Layer | Language |
| --- | --- |
| Application layer: editor UI, document/command bus, agent runtime, providers, exporters, MCP server, CLI, collaboration, build tooling | **TypeScript** (strict, ESM, Node ≥ 24 for tooling) |
| Desktop shell | **Rust** (Tauri 2): windows, filesystem, keychain, loopback proxy, MCP stdio shim, process spawning |
| CPU-heavy kernels | **WASM**: existing libraries first (manifold-3d, xatlas, meshoptimizer, Rapier, Draco/KTX2 decoders); new **Rust** crates only when a benchmark in CI proves a TypeScript implementation misses its budget and a library does not exist |
| GPU | **WGSL** via three.js **TSL** (node materials compile to WGSL on WebGPU and GLSL on the WebGL2 fallback) |
| Engine bridges | Host-dictated: GDScript (Godot), C# (Unity), Python (Unreal remote execution, Blender) |

Guardrails: `01-engineering-standards.md` (strict compiler flags, no `any`, Result-based errors, coverage and budget gates) supplies the rigor that a systems language would otherwise provide through its type system.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| **All Rust** (Bevy or wgpu + egui, compiled to WASM for the web) | Best raw performance, but: web UI toolkits in Rust are immature for a chat/inspector-heavy app; WASM binaries are large and slow to load; no equivalent of three.js's asset/material ecosystem; the AI, MCP and CRDT ecosystems are TypeScript-first (yrs exists, but the browser story is JS); LLM agents are markedly less reliable in Rust, and compile-error loops are expensive for weak agents. |
| **C++ core + TypeScript shell** (Figma model) | Proven for 2D vector editing; for a 3D composer it would mean rebuilding what three.js already does well. If a native core is ever needed, Rust → WASM gives comparable performance with better tooling and safety. |
| **Python** | Right for ML research, wrong for an interactive browser editor; used only where hosts require it (Blender, optional generation workers). |
| **Go** for servers | Not needed: the only servers are optional (collab room, generation worker) and small; keeping them in TypeScript/Python avoids a fourth toolchain. |

## Consequences

- One primary toolchain; every package runs in Node and browser except the engine (browser) and the desktop shell (Rust).
- Performance is achieved by architecture (incremental sync, instancing, workers, on-demand rendering) and enforced by budgets, not by language choice. Regressions fail CI.
- Rust appears from phase 5 (desktop) and, conditionally, in phase 7 (kernels). Contributors without Rust can work on 95% of the codebase.
- Weaker agents can implement most tickets: TypeScript with strict types, schemas and explicit interfaces is the most reliable target for LLM code generation available in 2026.

## What “best and fastest” means here

This decision was re-confirmed after the product owner asked for the best and fastest language. In this product those words do not mean “the language with the highest theoretical FLOPS.”

| Kind of fast | How Tessera gets it |
| --- | --- |
| Viewport / GPU | three.js WebGPU + TSL (WGSL). This is the hot path. Application language is not. |
| Document / commands | Typed command bus, incremental Yjs events, budgets in `01 §8` (0.5 ms primitive, 16 ms / 100 commands). |
| Mesh / import | Existing WASM (manifold, meshoptimizer, Draco, Rapier). New Rust kernels only after a failing budget. |
| Implementation by weaker agents | TypeScript + Zod contracts + tickets with file lists. A Rust/C++ editor would be slower to ship and worse for LLM-authored code. |
| Time-to-correct-PR | One language, one test runner, one linter. |

Revisit only if a CI benchmark shows a TypeScript path missing a published budget **and** no WASM library exists. That requires a new ADR, not a ticket-level rewrite.
