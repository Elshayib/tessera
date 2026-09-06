# Phase 1 — Composition editor

Milestone: `m1-composition-editor` · Depends on phase 0 complete
Expand any ticket marked Draft into full AC/Tests (copy `docs/templates/task-template.md`) **before** claiming it.

| Id | Title | Package | Depends | Status |
| --- | --- | --- | --- | --- |
| T-0100 | Freeze phase-1 tickets (fill AC/Tests for T-0101+) | `docs/tasks` | T-0010 | `todo` |
| T-0101 | `@tessera/storage`: BlobStore + Memory + archive codec `.tessera` | storage | T-0010 | `todo` |
| T-0102 | `@tessera/storage`: IndexedDB + OPFS project store | storage | T-0101 | `todo` |
| T-0103 | `@tessera/spatial`: AABB, world bounds, overlap, primitive bounds | spatial | T-0010 | `todo` |
| T-0104 | `@tessera/engine`: WebGPURenderer host, fallback, viewport loop | engine | T-0103 | `todo` |
| T-0105 | `@tessera/engine`: RendererSync + transform/mesh/light/camera handlers | engine | T-0104 | `todo` |
| T-0106 | `@tessera/engine`: picking (BVH), transform gizmos, camera-controls | engine | T-0105 | `todo` |
| T-0107 | `@tessera/engine`: screenshots + viewport stats | engine | T-0105 | `todo` |
| T-0108 | `@tessera/assets`: primitive geometry factory + default material | assets | T-0101 | `todo` |
| T-0109 | `@tessera/assets`: glTF import worker (gltf-transform normalize) | assets | T-0108 | `todo` |
| T-0110 | `@tessera/exporters`: glTF + sidecar from document (not from scene) | exporters | T-0101 | `todo` |
| T-0111 | `@tessera/exporters`: Three.js code export | exporters | T-0110 | `todo` |
| T-0112 | `@tessera/ui`: design tokens, shell, resizable panels, i18n en.ts | ui | T-0010 | `todo` |
| T-0113 | `@tessera/ui`: outliner (tree, reparent, search, tags) | ui | T-0112, T-0008 | `todo` |
| T-0114 | `@tessera/ui`: inspector generated from schema `.meta()` | ui | T-0112, T-0004 | `todo` |
| T-0115 | `apps/web`: bootstrap EditorContext, flags, Vite, empty project | web | T-0105, T-0112, T-0102 | `todo` |
| T-0116 | `apps/web`: viewport + gizmos + keyboard nudge | web | T-0115, T-0106 | `todo` |
| T-0117 | `apps/web`: create primitives, lights, cameras via commands | web | T-0116, T-0108 | `todo` |
| T-0118 | `apps/web`: save/load IndexedDB + `.tessera` download/open | web | T-0115, T-0102 | `todo` |
| T-0119 | `apps/web`: Playwright smoke + visual baseline R1-empty | web | T-0117 | `todo` |
| T-0120 | Poly Haven HDRI/environment fetch (CC0) behind flag | assets, web | T-0117 | `todo` |
| T-0121 | CLI `tessera export gltf` | cli | T-0110 | `todo` |
| T-0122 | Phase 1 exit: open export in Godot 4 and Blender 5 (manual + recorded) | docs | T-0110, T-0119 | `todo` |

## Specs

`05-rendering.md`, `08-assets-and-storage.md`, `09-export-and-bridges.md` (glTF + sidecar accepted), `01` budgets, ADR-0005, ADR-0008, ADR-0009.

## Ticket expansion rule (T-0100)

T-0100’s only job is to rewrite T-0101–T-0122 in the same depth as phase-0 tickets (Goal, Touches, AC, Tests, Non-goals). Do not implement T-0101 until T-0100 is `done`.

## Invariants you will test

`INV-ARCH-02` (engine does not import CommandBus), `INV-ARCH-04` (UI state not in document), `INV-ARCH-07` (gltf round-trip), `INV-RND-*` from `05`, command drag = one transaction (`INV-CMD-06`).
