# Phase 1 — Composition editor

Milestone: `m1-composition-editor` · Depends on phase 0 complete
Tickets below were frozen by **T-0100**. Do not implement T-0101 until T-0100 is `done`.

| Id | Title | Package | Depends | Status |
| --- | --- | --- | --- | --- |
| T-0100 | Freeze phase-1 tickets (fill AC/Tests for T-0101+) | `docs/tasks` | T-0010 | `in-progress` |
| T-0101 | `@tessera/storage`: BlobStore + Memory + archive codec `.tessera` | storage | T-0010 | `in-progress` |
| T-0102 | `@tessera/storage`: IndexedDB + OPFS project store | storage | T-0101 | `in-progress` |
| T-0103 | `@tessera/spatial`: AABB, world bounds, overlap, primitive bounds | spatial | T-0010 | `in-progress` |
| T-0104 | `@tessera/engine`: WebGPURenderer host, fallback, viewport loop | engine | T-0103 | `in-progress` |
| T-0105 | `@tessera/engine`: RendererSync + transform/mesh/light/camera handlers | engine | T-0104, T-0108 | `in-progress` |
| T-0106 | `@tessera/engine`: picking (BVH), transform gizmos, camera-controls | engine | T-0105 | `in-progress` |
| T-0107 | `@tessera/engine`: screenshots + viewport stats | engine | T-0105 | `in-progress` |
| T-0108 | `@tessera/assets`: primitive geometry factory + default material | assets | T-0101 | `in-progress` |
| T-0109 | `@tessera/assets`: glTF import worker (gltf-transform normalize) | assets | T-0108 | `in-progress` |
| T-0110 | `@tessera/exporters`: glTF + sidecar from document (not from scene) | exporters | T-0101, T-0108, T-0109 | `in-progress` |
| T-0111 | `@tessera/exporters`: Three.js code export | exporters | T-0110 | `in-progress` |
| T-0112 | `@tessera/ui`: design tokens, shell, resizable panels, i18n en.ts | ui | T-0010 | `in-progress` |
| T-0113 | `@tessera/ui`: outliner (tree, reparent, search, tags) | ui | T-0112, T-0008 | `in-progress` |
| T-0114 | `@tessera/ui`: inspector generated from schema `.meta()` | ui | T-0112, T-0004 | `in-progress` |
| T-0115 | `apps/web`: bootstrap EditorContext, flags, Vite, empty project | web | T-0105, T-0112, T-0102, T-0108 | `in-progress` |
| T-0116 | `apps/web`: viewport + gizmos + keyboard nudge | web | T-0115, T-0106 | `in-progress` |
| T-0117 | `apps/web`: create primitives, lights, cameras via commands | web | T-0116, T-0108 | `in-progress` |
| T-0118 | `apps/web`: save/load IndexedDB + `.tessera` download/open | web | T-0115, T-0102 | `in-progress` |
| T-0119 | `apps/web`: Playwright smoke + visual baseline R1-empty | web | T-0117 | `in-progress` |
| T-0120 | Poly Haven source (HDRI, models, textures) behind flag | assets, web | T-0117, T-0109 | `todo` |
| T-0121 | CLI `tessera export gltf` | cli | T-0110 | `todo` |
| T-0122 | Phase 1 exit: open export in Godot 4 and Blender 5 (manual + recorded) | docs | T-0110, T-0119 | `todo` |

## Specs

`05-rendering.md`, `08-assets-and-storage.md`, `09-export-and-bridges.md` (glTF + sidecar accepted), `01` budgets, ADR-0005, ADR-0008, ADR-0009.

## Invariants you will test

`INV-ARCH-02` (engine does not import CommandBus), `INV-ARCH-04` (UI state not in document), `INV-ARCH-07` (gltf round-trip), `INV-RND-*` from `05`, command drag = one transaction (`INV-CMD-06`).

---

# T-0100 — Freeze phase-1 tickets (fill AC/Tests for T-0101+)

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `docs/tasks` |
| Size | M |
| Depends on | T-0010 |
| Status | `in-progress` |

## Goal

Every phase-1 implementation ticket T-0101–T-0122 has Goal, Context, Touches, acceptance criteria, Tests, and Non-goals at the same depth as phase-0 tickets, copied from specs (not invented).

## Context

- Spec: `docs/18-implementation-playbook.md` §4 (do not start a ticket that lacks AC)
- Template: `docs/templates/task-template.md`
- Index: `docs/tasks/README.md` (first ticket of a phase freezes later tickets)

## Touches

```
docs/tasks/phase-1.md
scripts/check-phase-1-tickets.test.ts
docs/questions.md
```

## Acceptance criteria

1. T-0101 through T-0122 each have a `# T-0NNN —` heading plus Goal, Context, Touches, Acceptance criteria, Tests, Non-goals.
2. No T-0101–T-0122 ticket is a draft stub waiting to be expanded.
3. Touches and AC cite the linked spec sections; silent spots go in `docs/questions.md`.
4. A unit test fails if any of those sections is missing.

## Tests

| Test | File |
| --- | --- |
| `'T-0101–T-0122 have Goal, Context, Touches, AC, Tests, Non-goals'` | `scripts/check-phase-1-tickets.test.ts` |

## Non-goals

Implementing any package. Opening PRs for T-0001–T-0010. Git-tagging `m0-foundations`. Filling phase-2+ tickets.

## Notes for the implementing agent

T-0010 remains `in-progress` until PRs exist (Q-0025). This freeze still proceeds so phase 1 has claimable tickets.

---

# T-0101 — `@tessera/storage`: BlobStore + Memory + archive codec `.tessera`

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/storage` |
| Size | L |
| Depends on | T-0010 |
| Status | `in-progress` |

## Goal

`BlobStore` and `ProjectStore` from `08` §2 exist. `MemoryBlobStore` and `MemoryProjectStore` pass the storage contract. `.tessera` archive codec round-trips a project (`03` §10: ZIP with `project.tessera.json`, `blobs/`, `manifest.json`).

## Context

- Spec: `docs/08-assets-and-storage.md` §2–§5, `docs/03-domain-model.md` §10
- ADR: ADR-0008
- `@tessera/testing` already has a MemoryBlobStore duplicate until this package exists

## Touches

```
packages/storage/**
packages/testing/src/memory-blob-store.ts   (re-export or adapter of storage; justified)
.dependency-cruiser.cjs                    (yjs allowed in storage)
docs/questions.md
```

## Acceptance criteria

1. Public interfaces match `08` §2 (`BlobStore`, `ProjectStore`, `OpenProject`, `ProjectSummary`) with `Result` returns.
2. `INV-AST-01`: `read(write(x).hash)` returns identical bytes; writing the same bytes twice yields one stored copy and the same hash (`sha256-` + hex).
3. `MemoryProjectStore.create/open/snapshot/exportArchive/importArchive/duplicate/delete/list` work without IndexedDB or Node `fs` (Node-safe memory).
4. Archive ZIP layout matches `03` §10; `manifest.json` has `format: "tessera-archive"`, `version: 1`.
5. `importArchive` enforces SEC-08 (`14`): streaming unzip with per-entry and total size limits; entry names only `blobs/<hash>`, `blobs/index.json`, `project.tessera.json`, `manifest.json`.
6. Package README lists the API; layer 1; may import `yjs` for persistence helpers but must not import `three` or React.
7. Testing’s `MemoryBlobStore` is not a second implementation of hashing (re-export or thin wrapper).

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-01 write/read/dedupe'` | `packages/storage/src/memory-blob-store.test.ts` |
| `'memory project store create/open/snapshot'` | `packages/storage/src/memory-project-store.test.ts` |
| `'exportArchive then importArchive restores snapshot'` | `packages/storage/src/archive.test.ts` |
| `'malformed zip is I/O or INVALID_INPUT'` | `packages/storage/src/archive.test.ts` |
| `'SEC-08 rejects zip-slip and oversized entries'` | `packages/storage/src/archive.test.ts` |

## Non-goals

`OpfsBlobStore`, `IndexedDbProjectStore`, `FsBlobStore` (T-0102 / desktop). `ProjectStore.gc` (Q-0027). Import pipeline. Autosave debounce.

## Notes for the implementing agent

Do not use `node:fs` in Memory\* (allowed only for Fs later). Hash with WebCrypto (`08` §3); Node tests use `globalThis.crypto`. `create` templates `studio` | `outdoor` are unspecified (Q-0026): accept the union, implement `empty` only, return `UNSUPPORTED` for the others. Re-export testing’s MemoryBlobStore (Q-0009). Archive allow-list includes `blobs/index.json` (Q-0032).

---

# T-0102 — `@tessera/storage`: IndexedDB + OPFS project store

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/storage` |
| Size | L |
| Depends on | T-0101 |
| Status | `in-progress` |

## Goal

Browser `OpfsBlobStore` with fallback to `IndexedDbBlobStore`. `IndexedDbProjectStore` uses one `y-indexeddb` database per project (`tessera-project-<id>`) and an index in `tessera-projects` (`08` §2).

## Context

- Spec: `docs/08-assets-and-storage.md` §2, §4
- ADR: ADR-0003, ADR-0008

## Touches

```
packages/storage/src/opfs-blob-store.ts
packages/storage/src/indexeddb-blob-store.ts
packages/storage/src/indexeddb-project-store.ts
packages/storage/src/*.browser.test.ts
packages/storage/README.md
.dependency-cruiser.cjs
```

## Acceptance criteria

1. OPFS write/read/dedupe satisfies `INV-AST-01` in browser-mode tests; when OPFS is unavailable the store uses IndexedDB blobs.
2. `IndexedDbProjectStore.open` attaches a Yjs persistence provider; `close` detaches it.
3. `list()` returns summaries with `id`, `name`, `updatedAt`, `entityCount`.
4. Quota: `usage()` uses `navigator.storage.estimate()` when present; first write may call `navigator.storage.persist()` (`08` §4).
5. Autosave: `y-indexeddb` persists Yjs updates; a 5 s debounced canonical snapshot is written for listing/crash recovery (`08` §4). Tests use `FakeClock`, not `setTimeout` wall-clock.
6. Same contract tests as Memory\* (shared suite parameterized by implementation).

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-01 OPFS or IDB blobs'` | `packages/storage/src/browser-blob-store.browser.test.ts` |
| `'IndexedDbProjectStore list/create/open/close'` | `packages/storage/src/indexeddb-project-store.browser.test.ts` |
| `'contract suite Memory vs browser'` | `packages/storage/src/contract.test.ts` |
| `'5s snapshot uses FakeClock'` | `packages/storage/src/indexeddb-project-store.browser.test.ts` |

## Non-goals

`FsBlobStore` / `FsProjectStore` (Tauri/CLI later). Autosave snapshot files. UI quota warnings (apps/web). `gc()`.

## Notes for the implementing agent

Browser-mode Vitest + Playwright provider (`13` §2). Tests must not depend on wall-clock except FakeClock if timestamps are asserted. `y-indexeddb` is allowed only in storage.

---

# T-0103 — `@tessera/spatial`: AABB, world bounds, overlap, primitive bounds

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/spatial` |
| Size | M |
| Depends on | T-0010 |
| Status | `in-progress` |

## Goal

Pure Node-safe functions: local/world AABB, overlap/gap, ground-plane test, `frameBounds` for camera framing (`05` §8). Primitive analytic bounds match `@tessera/schema` `primitiveBounds`.

## Context

- Spec: `docs/02-architecture.md` §4 (`spatial`), `docs/05-rendering.md` §8–§9, `docs/03-domain-model.md` bounds
- Q-0021: core already has a temporary world AABB for `scene.measure`

## Touches

```
packages/spatial/**
.dependency-cruiser.cjs    (three math-only exception already present)
```

## Acceptance criteria

1. `worldAabb(entity, reader)` and overlap/gap are deterministic; no `three` Object3D.
2. If `three` is imported, only `three/src/math/*` (or documented math modules); depcruise still forbids engine/UI imports from spatial except the existing exception.
3. `sortByHierarchy` topologically sorts entity ids so parents precede children (`05` §4).
4. `frameBounds(targets, padding)` returns a camera pose input used by engine `frame` later (`05` §8).
5. Primitive box/sphere/cylinder/… AABB matches schema `primitiveBounds` within 1e-6.
6. Coverage ≥ 90% (`01` §7 spatial).

## Tests

| Test | File |
| --- | --- |
| `'world AABB matches primitive bounds at identity'` | `packages/spatial/src/world-aabb.test.ts` |
| `'overlap and gap'` | `packages/spatial/src/overlap.test.ts` |
| `'frameBounds padding'` | `packages/spatial/src/frame-bounds.test.ts` |
| `'sortByHierarchy parents before children'` | `packages/spatial/src/sort-by-hierarchy.test.ts` |

## Non-goals

Layout macros (`layout.*`, phase 2 T-0206). Rapier (phase 7). Replacing core `scene.measure` in this PR (optional note; do not migrate unless it stays inside Touches and size).

## Notes for the implementing agent

Layer 0–2: `Result` where failure is possible. Prefer schema bounds over tessellation.

---

# T-0104 — `@tessera/engine`: WebGPURenderer host, fallback, viewport loop

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/engine` |
| Size | L |
| Depends on | T-0103 |
| Status | `in-progress` |

## Goal

`EngineHandle` can mount a canvas, create a WebGPU renderer, fall back to WebGL2 (`05` §2–§3), run an on-demand animation loop, and dispose GPU resources (`INV-RND-05` partial: host + renderer).

## Context

- Spec: `docs/05-rendering.md` §2–§3, §11–§12
- ADR: ADR-0005

## Touches

```
packages/engine/**
.dependency-cruiser.cjs    (three only in engine)
packages/engine/src/*.browser.test.ts
```

## Acceptance criteria

1. `EngineHandle.capabilities` matches `EngineCapabilities` (`05` §3): `backend` is `'webgpu' | 'webgl2'`; if `navigator.gpu` is absent or `renderer.init()` rejects, recreate with `forceWebGL: true` and emit `capabilities.changed`.
2. Rendering is on demand (`05` §2): a dirty flag; at most one frame per animation frame; idle when clean.
3. `mount` / `unmount` / `requestRender` / `dispose` exist; dispose drops the renderer (`INV-RND-05` host).
4. `INV-RND-03` / `INV-ARCH-02`: engine must not import `CommandBus` (depcruise + test).
5. No document writes.

## Tests

| Test | File |
| --- | --- |
| `'INV-ARCH-02 engine does not import CommandBus'` | depcruise + `packages/engine/src/isolation.test.ts` |
| `'capabilities fallback is webgl2 or webgpu'` | `packages/engine/src/renderer.browser.test.ts` |
| `'dispose stops the loop'` | `packages/engine/src/renderer.browser.test.ts` |

## Non-goals

RendererSync handlers (T-0105). Picking/gizmos (T-0106). Screenshots (T-0107). Instancing flag (phase 2).

---

# T-0105 — `@tessera/engine`: RendererSync + transform/mesh/light/camera handlers

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/engine` |
| Size | L |
| Depends on | T-0104, T-0108 |
| Status | `in-progress` |

## Goal

Change sets mirror into a three.js scene: transform, meshRenderer, light, camera (`05` §4). Incremental sync is idempotent (`INV-RND-01`) and matches a full rebuild (`INV-RND-02`) on a small fixture (campfire or builder scene — not necessarily R1 yet).

## Context

- Spec: `docs/05-rendering.md` §4–§5, §13
- Coordinates: meters, Y-up, Euler XYZ degrees

## Touches

```
packages/engine/src/sync/**
packages/engine/src/structural-hash.ts
packages/testing/src/structural-hash.ts   (if shared; justified)
```

## Acceptance criteria

1. Applying the same change set twice yields the same structural hash (`INV-RND-01`).
2. Incremental apply equals rebuild from snapshot (`INV-RND-02`) on the campfire fixture.
3. Disabled entities: `visible = enabled` on the entity group (`05` §4.1).
4. Primitive meshes come from `@tessera/assets` (same generator exporters will use; `09` §3.2).
5. Failed geometry load uses a placeholder and does not mutate the document (`INV-RND-06` partial).

## Tests

| Test | File |
| --- | --- |
| `'INV-RND-01 change set twice'` | `packages/engine/src/sync/renderer-sync.browser.test.ts` |
| `'INV-RND-02 incremental equals rebuild'` | `packages/engine/src/sync/renderer-sync.browser.test.ts` |
| `'INV-RND-03 no CommandBus'` | depcruise |

## Non-goals

Gizmos, picking, screenshots, HDRI PMREM (T-0120). Auto-instancing.

## Notes for the implementing agent

Change sets are topologically sorted with `spatial.sortByHierarchy`. MeshStandardNodeMaterial / MeshPhysicalNodeMaterial per `05` §4. Do not import CommandBus.

---

# T-0106 — `@tessera/engine`: picking (BVH), transform gizmos, camera-controls

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/engine` |
| Size | L |
| Depends on | T-0105 |
| Status | `in-progress` |

## Goal

`pick` / `raycast` via `three-mesh-bvh`. `TransformControls` with drag protocol `INV-RND-04` / `INV-CMD-06`: no document writes during drag; one `intent: transform.set` batch on release. Orbit camera via `camera-controls` is UI state, not document.

## Context

- Spec: `docs/05-rendering.md` §6–§8, `docs/04-command-bus.md` INV-CMD-06

## Touches

```
packages/engine/src/picking.ts
packages/engine/src/gizmos.ts
packages/engine/src/viewport-camera.ts
packages/engine/src/*.browser.test.ts
```

## Acceptance criteria

1. `pick(x,y)` hits the nearest enabled mesh; disabled entities are never hit.
2. Layers 1–2 (helpers/gizmos) are ignored unless requested.
3. During drag, engine does not call any command/document write; on release it emits one `EngineIntent` `{ kind: 'transform.set'; targets; label }` batch (`INV-RND-04`, `05` §12).
4. Escape during drag restores Object3D snapshot.
5. `getViewportCamera` / `setViewportCamera` do not write the document (`INV-ARCH-04`).
6. `frame` uses `spatial.frameBounds` and animates 300 ms unless `prefers-reduced-motion` (`05` §8).

## Tests

| Test | File |
| --- | --- |
| `'pick nearest enabled entity'` | `packages/engine/src/picking.browser.test.ts` |
| `'INV-RND-04 drag emits one intent batch'` | `packages/engine/src/gizmos.browser.test.ts` |
| `'viewport camera is not in the document'` | `packages/engine/src/viewport-camera.browser.test.ts` |

## Non-goals

Keyboard nudge wiring in apps/web (T-0116). Outline pass (phase 2). Screenshot API (T-0107).

---

# T-0107 — `@tessera/engine`: screenshots + viewport stats

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/engine` |
| Size | M |
| Depends on | T-0105 |
| Status | `in-progress` |

## Goal

`screenshot(options)` renders to an offscreen target (`05` §10). Helpers/gizmos omitted unless `includeHelpers` (`INV-RND-07`). `stats` is `ViewportStats { fps, frameMs, drawCalls, triangles, textures, geometries, programs }`.

## Context

- Spec: `docs/05-rendering.md` §9–§10, §12

## Touches

```
packages/engine/src/screenshot.ts
packages/engine/src/stats.ts
packages/engine/src/screenshot.browser.test.ts
```

## Acceptance criteria

1. Default screenshot excludes helpers and gizmos (`INV-RND-07`).
2. `includeHelpers: true` includes them.
3. Viewport canvas is unaffected (dedicated render target).
4. Width/height honored, width ≤ 2048.
5. `stats` updates after `requestRender`.

## Tests

| Test | File |
| --- | --- |
| `'INV-RND-07 helpers excluded by default'` | `packages/engine/src/screenshot.browser.test.ts` |
| `'screenshot size'` | `packages/engine/src/screenshot.browser.test.ts` |
| `'stats drawCalls after render'` | `packages/engine/src/stats.browser.test.ts` |

## Non-goals

Vision critic, JPEG quality tuning UI, R1 leak test of 100 cycles (can be a later engine ticket if this PR exceeds 600 loc).

---

# T-0108 — `@tessera/assets`: primitive geometry factory + default material

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/assets` |
| Size | M |
| Depends on | T-0101 |
| Status | `in-progress` |

## Goal

Canonical mesh generator for schema `Primitive` types (positions, normals, uvs, indices) used by engine and exporters (`09` §3.2). Default PBR material asset for new primitives.

## Context

- Spec: `docs/05-rendering.md` §4 (geometry cache), `docs/09-export-and-bridges.md` §3.2, `docs/03` primitives
- Testing: `docBuilder` already creates primitive assets; this package is the runtime factory

## Touches

```
packages/assets/**
packages/assets/src/primitives.ts
packages/assets/src/default-material.ts
```

## Acceptance criteria

1. Every `Primitive` discriminant produces a triangle mesh; bounds match `primitiveBounds` within 1e-5.
2. Default material is valid `MaterialAsset` (license `unknown` or documented constant; Q-0014).
3. No document mutation; factory is pure + blob writes only when asked.
4. `@gltf-transform` not required yet (T-0109).
5. Engine/exporters can import this package (layer 2).

## Tests

| Test | File |
| --- | --- |
| `'box/sphere/plane vertex counts and bounds'` | `packages/assets/src/primitives.test.ts` |
| `'default material validates'` | `packages/assets/src/default-material.test.ts` |

## Non-goals

glTF import worker (T-0109). Poly Haven (T-0120). Thumbnails GPU.

---

# T-0109 — `@tessera/assets`: glTF import worker (gltf-transform normalize)

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/assets` |
| Size | L |
| Depends on | T-0108 |
| Status | `in-progress` |

## Goal

`import.worker` parses glTF/GLB with gltf-transform, writes blobs, returns an `ImportPlan`. The worker never touches the document (`INV-AST-02`). `AssetService.commitPlan` commits `asset.create` and `entity.create` in one transaction labeled `Import <fileName>` (`08` §7.5).

## Context

- Spec: `docs/08-assets-and-storage.md` §7
- `asset.import` command exists in schema but is unregistered until this pipeline (Q-0016)

## Touches

```
packages/assets/src/import-worker.ts
packages/assets/src/import-plan.ts
packages/assets/src/asset-service.ts
packages/assets/src/import.int.test.ts
packages/schema/fixtures/**              (small glTF fixtures)
```

## Acceptance criteria

1. Worker output is `ImportPlan` (`blobs`, `assets`, `entities?`, `warnings`, `attribution?`); no `Y.Map` / CommandBus inside the worker (`INV-AST-02`).
2. Single-mesh glTF proposes one entity; more than one mesh node proposes a tree (`08` §7.1).
3. Unsupported FBX/OBJ/USD/BLEND → `UNSUPPORTED`.
4. Hard blob size rejected; warn on > 2M triangles; non-triangle primitives skipped with warning.
5. `commitPlan` is one transaction; after commit `validateDocument` is ok.
6. Leave `asset.import` unregistered (Q-0016); `commitPlan` uses existing `asset.create` / `entity.create` handlers.

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-02 worker does not import CommandBus'` | depcruise + `packages/assets/src/import-worker.test.ts` |
| `'single mesh ImportPlan golden'` | `packages/assets/src/import.int.test.ts` |
| `'unsupported format UNSUPPORTED'` | `packages/assets/src/import.int.test.ts` |

## Non-goals

Draco/KTX2 encode options (phase 3). Kenney. Sketchfab. Main-thread 50 ms e2e with 50 MB (`INV-AST-06` later).

---

# T-0110 — `@tessera/exporters`: glTF + sidecar from document (not from scene)

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/exporters` |
| Size | L |
| Depends on | T-0101, T-0108, T-0109 |
| Status | `in-progress` |

## Goal

`Exporter` id `gltf` builds glTF + `<name>.tessera.json` from the **document** via gltf-transform, never from the three.js scene (`02` §6, `09` §3). Khronos validator reports zero errors. `INV-EXP-04` / `INV-ARCH-07` on primitives; `INV-AST-05` on an imported fixture glTF.

## Context

- Spec: `docs/09-export-and-bridges.md` §2–§4, §10
- ADR: ADR-0009

## Touches

```
packages/exporters/**
packages/exporters/src/engine-conventions.ts
packages/schema/src/sidecar.ts          (Zod for sidecar; JSON Schema emit justified)
packages/schema/json-schema/sidecar.v1.json
```

## Acceptance criteria

1. `INV-EXP-01`: exporters depend on document + `BlobStore`, never `@tessera/engine`.
2. Node `extras.tessera.id` present; sidecar `{ format: "tessera-sidecar", version: 1 }` matches `09` §4.
3. `INV-EXP-03`: `gltf-validator` zero errors on campfire or primitive fixture.
4. `INV-ARCH-07` / `INV-EXP-04`: re-import (T-0109 `commitPlan`) preserves ids, names, transforms within 1e-5, tags, colliders. Primitive documents use the T-0108 generator (`09` §3.2).
5. `INV-AST-05`: import a fixture glTF then export with no optimization; vertex/index counts and materials/textures preserved when no optimization option is enabled.
6. `options.deterministic === true` omits `exportedAt` (`09` §3.4; field is missing from the `GltfExportOptions` snippet — Q-0028).
7. `INV-EXP-02`: same document + deterministic options → byte-identical output.
8. `INV-AST-03`: `ATTRIBUTIONS.md` included when a license requires it; omitted when none.
9. `INV-EXP-05`: node `extras.tessera.id` and sidecar `entities[].id` / `nodeIndex` agree.
10. `engine-conventions.ts` holds the conversion table from `09` §5 with the listed test vectors.

## Tests

| Test | File |
| --- | --- |
| `'INV-EXP-03 gltf-validator primitives'` | `packages/exporters/src/gltf.test.ts` |
| `'INV-ARCH-07 / INV-EXP-04 round-trip primitives'` | `packages/exporters/src/round-trip.test.ts` |
| `'INV-AST-05 import then export fixture glTF'` | `packages/exporters/src/round-trip.test.ts` |
| `'INV-EXP-05 extras id matches sidecar'` | `packages/exporters/src/sidecar.test.ts` |
| `'INV-EXP-02 deterministic byte-identical'` | `packages/exporters/src/gltf.test.ts` |
| `'engine-conventions test vectors'` | `packages/exporters/src/engine-conventions.test.ts` |

## Non-goals

`code-three` (T-0111). Bridges (`09` §7 Draft). KTX2/Draco encode (phase 3).

---

# T-0111 — `@tessera/exporters`: Three.js code export

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/exporters` |
| Size | M |
| Depends on | T-0110 |
| Status | `in-progress` |

## Goal

`code-three` exporter emits ESM `scene.js` that loads `<name>.glb` with `GLTFLoader`, applies environment (PMREM), fog, tone mapping and exposure, and exposes `createScene({ renderer }) → { scene, camera, update }` (`09` §6). Snapshot-tested, deterministic.

## Context

- Spec: `docs/09-export-and-bridges.md` §6
- R3F is phase 2

## Touches

```
packages/exporters/src/code-three.ts
packages/exporters/src/code-three.test.ts
packages/exporters/fixtures/code-three/**
```

## Acceptance criteria

1. Exporter id is `code-three`; `fileExtensions` include `js`.
2. Generated JS is snapshot-stable when `deterministic` (or equivalent) is set.
3. Header comment includes Tessera version; no user formatter dependency.
4. Generated `createScene({ renderer })` returns `{ scene, camera, update }` in the source text.

## Tests

| Test | File |
| --- | --- |
| `'code-three snapshot'` | `packages/exporters/src/code-three.test.ts` |
| `'createScene mentioned in output'` | `packages/exporters/src/code-three.test.ts` |

## Non-goals

`code-r3f`. Running the generated module in a browser (optional smoke). Bundler-specific output.

---

# T-0112 — `@tessera/ui`: design tokens, shell, resizable panels, i18n en.ts

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/ui` |
| Size | M |
| Depends on | T-0010 |
| Status | `in-progress` |

## Goal

React shell with CSS variables `--t-…`, resizable panel layout, and `en.ts` messages. `describeError` maps `TesseraError` to i18n keys (`01` §6). No three.js.

## Context

- Spec: `docs/01-engineering-standards.md` (tokens, i18n), `docs/02-architecture.md` §4 ui
- INV-ARCH-04: UI store is not the document

## Touches

```
packages/ui/**
packages/ui/src/i18n/en.ts
packages/ui/src/describe-error.ts
packages/ui/src/shell.tsx
```

## Acceptance criteria

1. Tokens `--t-color-accent` (and documented set) exist.
2. Panel layout state is UI-only (zustand/localStorage), never Yjs.
3. `en.ts` covers shell chrome and `describeError` keys.
4. No `CommandBus` writes from presentational components in this ticket (no outliner/inspector yet).
5. depcruise: ui may use React; must not import `three`.

## Tests

| Test | File |
| --- | --- |
| `'describeError uses i18n key'` | `packages/ui/src/describe-error.test.ts` |
| `'INV-ARCH-04 layout not in document'` | `packages/ui/src/layout-store.test.ts` |
| `'shell renders regions'` | `packages/ui/src/shell.browser.test.ts` |

## Non-goals

Outliner (T-0113). Inspector (T-0114). Chat/review (phase 2). Viewport canvas (T-0116).

---

# T-0113 — `@tessera/ui`: outliner (tree, reparent, search, tags)

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/ui` |
| Size | L |
| Depends on | T-0112, T-0008 |
| Status | `in-progress` |

## Goal

Accessible tree of entities (the viewport canvas is `aria-hidden`; outliner is the scene representation — `01` a11y). Reparent and reorder go through commands. Search filters by name/tag. Selection lives in the UI store (`INV-ARCH-04`).

## Context

- Spec: `docs/01-engineering-standards.md` a11y, `docs/04` entity commands, `docs/glossary.md` Panel

## Touches

```
packages/ui/src/outliner/**
packages/ui/src/selection-store.ts
```

## Acceptance criteria

1. Tree order matches sibling `order` / `entity.children` query.
2. Reparent/reorder dispatch `entity.setParent` / `entity.reorder` via injected `CommandBus` — one user gesture, one transaction.
3. Selection is not written into the document.
4. Search uses the same glob rules as `scene.find` (`04` §10 `name` glob) plus tag filter.
5. Keyboard: arrow navigation in the tree.

## Tests

| Test | File |
| --- | --- |
| `'INV-ARCH-04 selection not persisted in snapshot'` | `packages/ui/src/outliner/outliner.test.ts` |
| `'reparent calls entity.setParent'` | `packages/ui/src/outliner/outliner.test.ts` |
| `'search filters by name'` | `packages/ui/src/outliner/outliner.test.ts` |

## Non-goals

Inspector fields. Multi-user presence dots. Drag onto viewport.

---

# T-0114 — `@tessera/ui`: inspector generated from schema `.meta()`

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/ui` |
| Size | L |
| Depends on | T-0112, T-0004 |
| Status | `in-progress` |

## Goal

Inspector widgets from Zod `.meta()` (`03` §13, `INV-DOC-09`). Edits commit through commands (`component.set`, `transform.set`, …), one commit per interaction (`INV-CMD-06` for sliders).

## Context

- Spec: `docs/03-domain-model.md` §13, `docs/04-command-bus.md` INV-CMD-06

## Touches

```
packages/ui/src/inspector/**
```

## Acceptance criteria

1. Widgets: number, slider, vec3, color, toggle, select, text at minimum (others as schema uses them).
2. Unknown widget → visible fallback, no crash.
3. Slider drag = one transaction on pointer up (`INV-CMD-06`).
4. Reads current values from `DocumentReader` / queries, not a duplicated document store (`INV-ARCH-04`).

## Tests

| Test | File |
| --- | --- |
| `'slider commit is one component.set'` | `packages/ui/src/inspector/inspector.test.ts` |
| `'color widget for hex field'` | `packages/ui/src/inspector/inspector.test.ts` |
| `'INV-CMD-06'` | `packages/ui/src/inspector/inspector.test.ts` |

## Non-goals

Asset picker modal (can be a stub). Script/behavior editor (phase 7).

---

# T-0115 — `apps/web`: bootstrap EditorContext, flags, Vite, empty project

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `apps/web` |
| Size | L |
| Depends on | T-0105, T-0112, T-0102, T-0108 |
| Status | `in-progress` |

## Goal

Vite app boots `EditorContext` (`02` §7): `document`, `commands`, `queries`, `undo`, `jobs`, `storage`, `assets`, optional `engine`. `flags.ts` typed; unfinished features default false. Empty project loads. `size-limit` budgets from `01` §8.

## Context

- Spec: `docs/02-architecture.md` §7, `docs/01` §8 bundle, `docs/glossary.md` Flag

## Touches

```
apps/web/**
apps/web/src/flags.ts
apps/web/src/bootstrap.ts
apps/web/.size-limit.json
.github/workflows/ci.yml               (web job if missing)
```

## Acceptance criteria

1. `EditorContext` fields match `02` §7 (`document`, `commands`, `queries`, `undo`, `jobs`, `components`, `storage`, `assets`, optional `engine`/`agent`, `logger`, `clock`, `flags`).
2. Flags are a typed object; unfinished features default false (`?flag=` in dev).
3. Empty project: `validateDocument` ok after bootstrap.
4. `pnpm --filter @tessera/web build` succeeds.
5. `apps/web/.size-limit.json`: initial JS (gz) ≤ 350 KB; engine chunk lazy ≤ 900 KB; total empty project ≤ 1.5 MB (`01` §8). Engine is a lazy chunk.
6. `assets` may be a façade whose import path is `UNSUPPORTED` until T-0109 (Q-0030).

## Tests

| Test | File |
| --- | --- |
| `'flags default off'` | `apps/web/src/flags.test.ts` |
| `'bootstrap empty document validates'` | `apps/web/src/bootstrap.test.ts` |

## Non-goals

Viewport tools (T-0116). Save UI (T-0118). Playwright (T-0119).

---

# T-0116 — `apps/web`: viewport + gizmos + keyboard nudge

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `apps/web` |
| Size | M |
| Depends on | T-0115, T-0106 |
| Status | `in-progress` |

## Goal

Viewport hosts `EngineHandle`. Gizmo intents become one `transform.set` transaction (`INV-CMD-06`). Arrow-key nudge moves selection by snap increment (`05` §7, `01` a11y).

## Context

- Spec: `docs/05-rendering.md` §7, `docs/01` keyboard nudge

## Touches

```
apps/web/src/viewport/**
packages/ui/src/viewport-host.tsx      (if the host lives in ui; justified)
```

## Acceptance criteria

1. Canvas is `aria-hidden`; outliner remains the accessible tree (T-0113 may land in parallel — if outliner missing, still set aria-hidden).
2. Intent `transform.set` → single `commands.execute` / transaction labeled `Move|Rotate|Scale <name>` (`05` §7).
3. Arrow keys emit the same intents with snap; Shift multiplies the increment (spec: keyboard nudge required; ×10 is the conservative increment when unspecified — Q-0031).
4. Viewport camera stays UI state (`INV-ARCH-04`).

## Tests

| Test | File |
| --- | --- |
| `'INV-CMD-06 gizmo release one transaction'` | `apps/web/src/viewport/nudge.test.ts` or e2e later |
| `'arrow nudge calls transform.set'` | `apps/web/src/viewport/nudge.test.ts` |

## Non-goals

Create-menu (T-0117). Visual baselines (T-0119).

---

# T-0117 — `apps/web`: create primitives, lights, cameras via commands

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `apps/web` |
| Size | M |
| Depends on | T-0116, T-0108 |
| Status | `in-progress` |

## Goal

User can add box/sphere/… primitives, punctual lights, and a camera through catalog commands (`entity.create`, `component.add`, `material.create` as needed). Behind flags if the ticket lands before T-0119.

## Context

- Spec: `docs/04` entity/component commands, `docs/03` components

## Touches

```
apps/web/src/create-menu/**
apps/web/src/flags.ts
```

## Acceptance criteria

1. Each create path uses the command bus only (no direct Yjs).
2. New mesh entities get the T-0108 default material / geometry factory.
3. `camera.setMain` available for a newly created camera.
4. After create, `validateDocument` ok.

## Tests

| Test | File |
| --- | --- |
| `'create box goes through entity.create'` | `apps/web/src/create-menu/create-menu.test.ts` |
| `'create point light'` | `apps/web/src/create-menu/create-menu.test.ts` |

## Non-goals

glTF upload UI (T-0109 + later). Poly Haven (T-0120).

---

# T-0118 — `apps/web`: save/load IndexedDB + `.tessera` download/open

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `apps/web` |
| Size | M |
| Depends on | T-0115, T-0102 |
| Status | `in-progress` |

## Goal

Save/open the current project via `IndexedDbProjectStore`. Download/import `.tessera` archives via `exportArchive` / `importArchive`.

## Context

- Spec: `docs/08` §2, `docs/03` §10

## Touches

```
apps/web/src/project-io/**
```

## Acceptance criteria

1. Save then reload restores canonicalize snapshot (or Yjs equality after canonicalize).
2. Download produces a `.tessera` ZIP that `importArchive` can open.
3. Failed I/O uses `describeError`, not `console.*`.

## Tests

| Test | File |
| --- | --- |
| `'export then import archive'` | `apps/web/src/project-io/project-io.test.ts` (memory store in Node) |
| `'save/load round-trip'` | `apps/web/src/project-io/project-io.browser.test.ts` |

## Non-goals

Cloud sync. Multi-tab locking (phase 6).

---

# T-0119 — `apps/web`: Playwright smoke + visual baseline R1-empty

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `apps/web` |
| Size | M |
| Depends on | T-0117 |
| Status | `in-progress` |

## Goal

Playwright Chromium smoke: app loads, empty project visible. Visual baseline for the empty viewport (Q-0029: this is not the R1 1000-entity scene). `pnpm test:e2e` is wired.

## Context

- Spec: `docs/13-testing-and-evals.md` §2, `docs/01` visual
- Q-0029: empty viewport baseline, not R1

## Touches

```
apps/web/e2e/**
playwright.config.ts
.github/workflows/ci.yml
```

## Acceptance criteria

1. Smoke spec: page loads, no pageerror, shell landmark visible.
2. Visual spec: empty viewport screenshot committed (Chromium).
3. `pnpm test:e2e` runs Playwright.
4. WebKit/Firefox not required to pass CI (non-blocking per `13`).

## Tests

| Test | File |
| --- | --- |
| `'smoke loads editor'` | `apps/web/e2e/smoke.spec.ts` |
| `'visual empty viewport'` | `apps/web/e2e/visual/empty.spec.ts` |

## Non-goals

R1 1000-mesh visual. Godot/Blender (T-0122).

---

# T-0120 — Poly Haven source (HDRI, models, textures) behind flag

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `@tessera/assets`, `apps/web` |
| Size | L |
| Depends on | T-0117, T-0109 |
| Status | `todo` |

## Goal

Built-in `AssetSource` id `polyhaven` implements `08` §6 for kinds `hdri`, `model`, and `texture` (CC0-1.0). This ticket turns that source on in `flags.ts`. Search text is untrusted (`06` §12) and is shown inside `<untrusted>` when passed to the agent.

## Context

- Spec: `docs/08-assets-and-storage.md` §6 (phase 1 includes models, textures, HDRIs)
- Network: tests use recorded fixtures, not live API (`AGENTS.md`)

## Touches

```
packages/assets/src/sources/polyhaven.ts
packages/assets/src/sources/polyhaven.test.ts
apps/web/src/flags.ts
apps/web/src/asset-panel/**
```

## Acceptance criteria

1. `descriptor.kinds` is `model`, `texture`, `hdri`; `defaultLicense` is CC0-1.0; `requiresKey` is false; `attributionRequired` is false (attribution still recorded).
2. `search` / `fetch` match `AssetSource`; `fetch` writes blobs and sets `license` ≠ `unknown` plus `provenance` (`INV-AST-04`).
3. Tests replay fixture JSON (no network). Pagination and failure modes covered (`08` test plan).
4. Applying an HDRI uses commands (`environment.set` / `asset.create` / `commitPlan` as appropriate); no direct Yjs.
5. Fetching a model goes through `import.worker` then `commitPlan` (`INV-AST-02`).
6. Flag `polyHaven` (name may vary) defaults **true** when this ticket lands — this is the ticket that turns the source on. Kenney stays off.

## Tests

| Test | File |
| --- | --- |
| `'polyhaven search fixture hdri/model/texture'` | `packages/assets/src/sources/polyhaven.test.ts` |
| `'fetch writes blob + CC0 license + provenance'` | `packages/assets/src/sources/polyhaven.test.ts` |
| `'untrusted description is not interpolated raw'` | `packages/assets/src/sources/polyhaven.test.ts` |

## Non-goals

Kenney. Sketchfab. Generation. Live network in CI.

---

# T-0121 — CLI `tessera export gltf`

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `apps/cli` |
| Size | S |
| Depends on | T-0110 |
| Status | `todo` |

## Goal

`tessera export gltf <path> --out <dir>` runs the glTF exporter headless (`INV-ARCH-06` still no `three`). Exit 0 on success; 1 I/O; 2 validation/export errors.

## Context

- Spec: `docs/02` apps/cli, `docs/09` exporter, T-0009 validate pattern (Q-0024 JSON vs files)

## Touches

```
apps/cli/src/export.ts
apps/cli/src/export.test.ts
apps/cli/src/cli.ts
.dependency-cruiser.cjs
README.md
```

## Acceptance criteria

1. Binary still `tessera`; subcommands `validate` and `export`.
2. Writes glb/gltf + sidecar into `--out`.
3. Campfire or primitive fixture export exit 0.
4. `three` still absent from CLI graph (`INV-ARCH-06`).
5. Root README mentions `pnpm tessera export`.

## Tests

| Test | File |
| --- | --- |
| `'export gltf campfire exit 0'` | `apps/cli/src/export.test.ts` |
| `'INV-ARCH-06 cli still no three'` | depcruise |

## Non-goals

`eval`, `inspect`. `code-three` CLI. Watch mode.

---

# T-0122 — Phase 1 exit: open export in Godot 4 and Blender 5 (manual + recorded)

| Field | Value |
| --- | --- |
| Phase | 1 |
| Package | `docs` |
| Size | S |
| Depends on | T-0110, T-0119 |
| Status | `todo` |

## Goal

Documented, recorded procedure: a phase-1 export opens in Godot 4 and Blender 5 with hierarchy/names intact (`17` m1 exit). No new engine features.

## Context

- Spec: `docs/17-roadmap.md` phase 1 exit, `docs/09` §7 Draft (bridges are phase 4 — this ticket is **manual open of glTF**, not shipping add-ons)

## Touches

```
docs/runbooks/phase-1-export-check.md
docs/17-roadmap.md
evals/reports/ or docs/recordings/     (link only; binary recordings not required in git)
```

## Acceptance criteria

1. Runbook lists Godot 4.x and Blender 5.x versions, export command, and what to assert (node names, unit scale).
2. A fixture export from T-0110 is referenced.
3. Checklist in the PR template / runbook for a human to attach screenshots; this ticket does **not** invent a Godot CI job.
4. Roadmap phase 1 row is not marked complete until that human evidence exists (same pattern as Q-0025).

## Tests

| Test | File |
| --- | --- |
| `'runbook exists and names Godot and Blender'` | `scripts/check-phase-1-export-runbook.test.ts` |

## Non-goals

`bridges/godot-addon` implementation (phase 4). Unreal. Live MCP push.

## Notes for the implementing agent

Do not git-tag `m1-composition-editor`. Do not claim the phase complete without recordings.
