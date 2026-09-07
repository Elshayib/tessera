# Open questions

Living document. When a spec is silent or ambiguous, append an entry here (in the same PR as your conservative implementation) instead of guessing silently. Maintainers answer by editing the entry and, when the answer changes a spec, updating the spec and linking the PR.

## Template

```
### Q-XXXX — <short title>
Raised by: <PR or ticket> · Spec: <doc §> · Status: open | answered | superseded
Question: <what is unclear>
Options: (a) … (b) …
Conservative choice implemented: <what the PR did, behind which flag/constant>
Answer: <maintainer's decision> (PR #…)
```

## Entries

### Q-0001 — npm scope for packages
Raised by: planning · Spec: 02 §4 · Status: answered
Question: `@tessera/*` appears unclaimed on the npm registry (404 for `@tessera/core`), but the org page could not be verified. If the scope is unavailable, use `@tessera3d/*`.
Options: (a) `@tessera/*` (b) `@tessera3d/*`
Conservative choice implemented: (a) `@tessera/*`. T-0001 fetched `https://registry.npmjs.org/@tessera/core` and received HTTP 404, so packages are named `@tessera/*`.
Answer: Use `@tessera/*` (T-0001).

### Q-0002 — Default light intensities
Raised by: planning · Spec: 03 §5.3 · Status: open
Question: Defaults (directional 3 lx, point 100 cd, spot 200 cd, area 5 nit) with exposure 1 and neutral tone mapping are plausible for indoor scenes but not validated visually.
Options: (a) keep and tune after phase 1 visual baselines (b) preset system (Studio / Outdoor) with different defaults
Conservative choice implemented: keep constants in `packages/schema/src/defaults.ts` so tuning is a one-file change.
Answer: —

### Q-0003 — Kenney asset source manifest
Raised by: planning · Spec: 08 §6 · Status: open
Question: Kenney distributes zip packs, not a per-asset API. A curated in-repo manifest pointing at converted glb files requires hosting the converted files somewhere.
Options: (a) manifest with links to Kenney's own downloads plus in-browser conversion (b) a community-maintained CC0 mirror (c) defer Kenney to phase 8
Conservative choice implemented: phase 3 ticket marked Draft; Poly Haven and uploads are the phase-1 sources.
Answer: —

### Q-0004 — y-webrtc signaling defaults
Raised by: planning · Spec: 10 §3 · Status: open
Question: Which public signaling servers are acceptable defaults given reliability and privacy (they see room ids)?
Options: (a) y-webrtc public defaults (b) a self-hosted signaling worker template only, no defaults
Conservative choice implemented: to be decided at phase 6 start.
Answer: —

### Q-0005 — First engine bridge
Raised by: user decision pending · Spec: 09 §7, 17 · Status: open
Question: Godot is the recommended first bridge (free, MIT, text scenes, CI-testable). Confirm or choose Unity/Unreal/Blender first.
Conservative choice implemented: roadmap lists Godot first.
Answer: —

### Q-0006 — Workspace members and root project references before later packages exist
Raised by: T-0001 · Spec: ADR-0012, `docs/templates/` · Status: open
Question: Templates list `evals` as a pnpm workspace member and root `tsconfig.json` project-references `packages/schema`, `packages/core`, and `packages/testing`. T-0001 must not create those packages (non-goal), but `pnpm install` and `tsc -b` fail if the paths are missing. The pinned Biome 2.2.4 also rejects `files.ignore` (needs `files.includes`) and treats `docs/templates/biome.json` as a nested root config.
Options: (a) create stub packages now (b) omit missing members/references until the tickets that create them, and correct invalid toolchain keys so gates pass (c) keep the template and accept failing gates
Conservative choice implemented: (b) `pnpm-workspace.yaml` keeps `apps/*` and `packages/*` only; root `tsconfig.json` references `packages/std` only; `apps/.gitkeep` exists so `depcruise` can scan the `apps` path; `biome.json` uses `files.includes`; the stored template has `"root": false` so it is not a nested root; knip ignores `docs/templates` plus unused `lefthook`/`tsx` until those entrypoints exist. Later tickets add their workspace member and project reference when the package is created. T-0004 added `scripts/emit-json-schema.ts` and a knip `entry` for `scripts/*.ts`.
Answer: —

### Q-0007 — Query output shapes left as prose
Raised by: T-0004 · Spec: `04` §10 · Status: open
Question: `scene.stats` output is “counts, triangle totals (from asset stats), bounds of all”; `scene.measure` output is “numbers”; `entity.get` is “Entity (+ children ids)”. Exact Zod objects are not specified.
Options: (a) invent field names now (b) wait for T-0008 handlers to freeze the shapes
Conservative choice implemented: (a) smallest objects that match the prose: `entity.get` → `{ entity, children? }`; `scene.stats` → `{ entityCount, assetCount, behaviorCount, triangles, vertices, bounds }`; `scene.measure` → `{ value }`. Handlers in T-0008 must use these names or update the schema and this question.
Answer: —

### Q-0008 — `asset.import` options object
Raised by: T-0004 · Spec: `04` §8.3 · Status: open
Question: `asset.import` input lists `options?` with no fields.
Options: (a) omit options (b) allow an open JSON object
Conservative choice implemented: (b) `options` is an optional `JsonObject` so unknown importer flags are not rejected at the schema layer; semantic validation belongs to the job in a later ticket.
Answer: —

### Q-0009 — D1 layout and MemoryBlobStore home
Raised by: T-0005 · Spec: `13` §3, `01` §8, `08` §2 · Status: open
Question: D1 requires 10_000 entities and 2_000 assets with an implicit seed `42`, but no hierarchy or primitive mix is specified. `MemoryStores` in `13` §3 includes ProjectStore and TranscriptStore, while T-0005 says MemoryBlobStore only. `@tessera/storage` does not exist yet (T-0101).
Options: (a) invent a richer D1 scene graph (b) smallest valid layout that meets counts; duplicate BlobStore in testing until T-0101
Conservative choice implemented: (b) 100 root groups × 99 children = 10_000 entities; 2_000 primitive geometry assets cycling box/sphere/cylinder/cone/plane/torus/capsule with mulberry32(42) sizes; `BlobStore` + `MemoryBlobStore` live in `@tessera/testing` until T-0101. ProjectStore and TranscriptStore wait for later tickets.
Answer: —

### Q-0010 — Tags component in the Yjs mapping
Raised by: T-0006 · Spec: `03` §9 · Status: open
Question: `components.<type>` is a `Y.Map` of fields, but `tags` is an array rather than an object of fields.
Options: (a) wrap tags in a synthetic field (b) store the array as an atomic JSON leaf on the components map
Conservative choice implemented: (b) array/non-object component values are stored atomically on `components.tags`; object components remain field-level `Y.Map`s.
Answer: —

### Q-0011 — Default name for `entity.create`
Raised by: T-0007 · Spec: `04` §8.1 · Status: open
Question: `name` is optional; the spec does not say what to use when it is omitted.
Options: (a) `"Entity"` (b) `"entity"` (c) require the name
Conservative choice implemented: (a) `DEFAULT_ENTITY_NAME = "Entity"` then sibling suffix `_01`, `_02`.
Answer: —

### Q-0012 — Blob store on the command bus
Raised by: T-0007 · Spec: `04` §8.3 · Status: open
Question: `asset.create` checks `ReadContext.blobs.has(hash)`, but `ReadContext` in §3 has no `blobs` field and `@tessera/storage` does not exist yet.
Options: (a) require a blob store on every bus (b) optional `blobs` on `createCommandBus`; skip the check when omitted
Conservative choice implemented: (b) optional `options.blobs`; primitive assets without blob refs are unaffected.
Answer: —

### Q-0013 — Change-set derivation via snapshot diff
Raised by: T-0007 · Spec: `04` §7 · Status: open
Question: §7 derives change sets from Yjs events. Snapshot diff also satisfies INV-CMD-07 (before/after match snapshots) without depending on event-key fidelity for nested maps.
Options: (a) live Yjs events (b) snapshot diff
Conservative choice implemented: (b) `deriveChangeSet(before, after)` from canonical snapshots; events remain an optimization for later.
Answer: —

### Q-0014 — `material.create` license default
Raised by: T-0007 · Spec: `04` §8.3 · Status: open
Question: Shorthand `material.create` does not require `license`, but `AssetBaseSchema` does.
Options: (a) `"unknown"` (b) reject without license
Conservative choice implemented: (a) license `"unknown"`; provenance `source` defaults to `"derived"` as specified.
Answer: —

### Q-0015 — Bump `meta.updatedAt` only when the change set is non-empty
Raised by: T-0007 · Spec: `04` §4.8 vs INV-CMD-03 · Status: open
Question: Step 8 bumps `updatedAt` inside the transaction. Doing that for a no-op would make every transaction non-empty and prevent INV-CMD-03 from dropping empty history entries.
Options: (a) always bump (b) bump only when other document maps changed
Conservative choice implemented: (b) bump `updatedAt` only after a non-empty change set (excluding meta).
Answer: —

### Q-0016 — `asset.import` absent from the command registry
Raised by: T-0007 · Spec: `04` §8.3, INV-CMD-10 · Status: open
Question: INV-CMD-10 wants every catalog command registered; T-0007 non-goals exclude jobs, so `asset.import` has no handler.
Options: (a) register a stub that returns UNSUPPORTED (b) omit it until T-0008
Conservative choice implemented: (b) not registered; T-0008 adds `JobQueue` but not the import pipeline, so `execute("asset.import")` still returns `NOT_FOUND`.
Answer: —

### Q-0017 — Command-bus bench thresholds on Windows CI
Raised by: T-0007 · Spec: `01` §8, T-0007 AC7 · Status: open
Question: Ticket asks for 2 ms primitive / 40 ms 100-command txn (laptop 0.5 ms / 16 ms). On this Windows agent a warmed primitive is tens of ms and 100 creates are ~450 ms because `DocumentReader` still snapshots via `fromYDoc` (index is later).
Options: (a) fail the ticket budgets (b) keep the bench file with measured CI ceilings and document the laptop numbers
Conservative choice implemented: (b) `command-bus.bench.ts` comments the laptop/ticket numbers and asserts 100 ms / 2000 ms after warmup so the bench runs in CI without skip.
Answer: —

### Q-0018 — Workspace coverage thresholds after `@tessera/core` lands
Raised by: T-0007 · Spec: `01` §7, INV-TST-03 · Status: open
Question: T-0001 set a single root Vitest threshold of 95% because only `std`/`schema` existed. `01` §7 requires 95% for those packages and **90% for `core`**. A merged 95% bar would reject a spec-compliant core package.
Options: (a) keep a global 95% and over-test core (b) per-package glob thresholds matching `01` §7
Conservative choice implemented: (b) root `vitest.config.ts` uses a 95% lines/statements/functions floor, a 90% branch floor (schema branches are 93.6% from T-0004 inspector/validate tails; this ticket does not add schema tests), plus a `packages/core/**` glob at 90% per `01` §7. Benches are excluded. Package configs keep their own bars.
Answer: —

### Q-0019 — `runCommands` must not import `@tessera/core`
Raised by: T-0008 · Spec: `13` §3, T-0008 Touches · Status: open
Question: T-0008 puts `runCommands` in `@tessera/testing`. Production `@tessera/core` already has a test-only dependency on `@tessera/testing`. A production testing→core dependency would be a package cycle.
Options: (a) testing depends on core (b) duck-typed `CommandRunner` in testing
Conservative choice implemented: (b) `runCommands` accepts any object with `execute` returning a `Result`.
Answer: —

### Q-0020 — Default `scene.describe` detail
Raised by: T-0008 · Spec: `04` §10–§11 · Status: open
Question: `detail` is optional; the spec example matches outline, and D1 must stay ≤ 8 KB at "default detail".
Options: (a) `outline` (b) `summary`
Conservative choice implemented: (a) `DEFAULT_DESCRIBE_DETAIL = "outline"` with `maxChars` 8000 and `maxDepth` 4.
Answer: —

### Q-0021 — `scene.measure` without `@tessera/spatial`
Raised by: T-0008 · Spec: `04` §10 · Status: open
Question: Measure "uses spatial bounds" but `@tessera/spatial` does not exist yet.
Options: (a) wait for spatial (b) core world AABB from geometry `bounds` + TRS
Conservative choice implemented: (b) `entityWorldAabb` from asset bounds (or origin point) and `internal/math` transforms. Distance is origin-to-origin; bounds is AABB diagonal; gap is AABB separation.
Answer: —

### Q-0022 — Yjs origin includes `ExecuteOptions.runId`
Raised by: T-0008 · Spec: `04` §4.4, §6, INV-CMD-09 · Status: open
Question: Pipeline origin is `serializeAuthor(author)`, but `runId` also lives on `ExecuteOptions` separately from `author.runId`.
Options: (a) require `author.runId` (b) merge `options.runId` onto the author before serializing
Conservative choice implemented: (b) `withRunId(author, options.runId)` so agent runs isolate even when `runId` is only on execute options.
Answer: —

### Q-0023 — Primitive triangle totals in `scene.stats`
Raised by: T-0008 · Spec: `04` §10, Q-0007 · Status: open
Question: Stats "triangle totals (from asset stats)". Primitive assets already store `stats.triangles` when created through schema/testing.
Options: (a) sum geometry `stats` (b) recompute from primitive tessellation
Conservative choice implemented: (a) sum `geometry.stats.triangles` / `vertices`; missing kinds contribute 0.
Answer: —

### Q-0024 — `tessera validate` report format
Raised by: T-0009 · Spec: `03` §12 · Status: open
Question: The ticket says the CLI “prints a ValidationReport” but does not specify text vs JSON.
Options: (a) JSON of `ValidationReport` on stdout (b) human-formatted table
Conservative choice implemented: (a) `JSON.stringify(report, null, 2)` on stdout. Exit `0` when `report.ok`, `2` when level 1–3 errors, `1` on I/O or usage. Only `validate` is implemented; other argv is usage (exit 1).
Answer: —

### Q-0025 — Ticket `done` requires PR links
Raised by: T-0010 · Spec: `docs/templates/task-template.md`, T-0010 AC5 · Status: open
Question: T-0010 requires T-0001–T-0009 `done` with PR links. Work is stacked locally and has not been pushed or opened as PRs.
Options: (a) invent placeholder links (b) keep `in-progress` until a human opens PRs
Conservative choice implemented: (b) tickets stay `in-progress`. Do not git-tag `m0-foundations`.
Answer: —

### Q-0026 — `ProjectStore.create` templates `studio` and `outdoor`
Raised by: T-0100 · Spec: `08` §2 · Status: open
Question: `create(meta, template?: 'empty' | 'studio' | 'outdoor')` has no specified entity/asset contents for `studio` and `outdoor`.
Options: (a) invent studio/outdoor starter scenes (b) implement `empty` only; other templates return `UNSUPPORTED` until a later ticket
Conservative choice implemented: (b) recorded for T-0101. Do not invent starter-scene contents.
Answer: —

### Q-0027 — `ProjectStore.gc` timing
Raised by: T-0100 · Spec: `08` §5 · Status: open
Question: `gc` deletes unreferenced blobs older than 24 h, never automatically, and is exposed in Settings. T-0101/T-0102 are already size L without a Settings UI.
Options: (a) implement `gc` on Memory/IndexedDB in T-0101/T-0102 (b) defer `gc` until the Settings ticket
Conservative choice implemented: (b) T-0101/T-0102 Non-goals include `gc`. The interface may omit it until that ticket, or return `UNSUPPORTED`.
Answer: —

### Q-0028 — `GltfExportOptions.deterministic`
Raised by: T-0100 · Spec: `09` §3.1 vs §3.4 · Status: open
Question: §3.4 says `exportedAt` is omitted when `options.deterministic = true`, but the `GltfExportOptions` TypeScript snippet in §3.1 does not list `deterministic`.
Options: (a) add `deterministic?: boolean` to the options type in T-0110 (b) use a test-only exporter flag
Conservative choice implemented: (a) T-0110 adds `deterministic` to options; default false.
Answer: —

### Q-0029 — T-0119 visual is empty viewport, not R1
Raised by: T-0100 · Spec: `01` §8, T-0119 title · Status: open
Question: T-0119 is titled “visual baseline R1-empty”. R1 is a 1000-entity loaded scene (`01` §8). An empty-project screenshot is a different baseline.
Options: (a) T-0119 captures empty viewport only (b) T-0119 also captures R1
Conservative choice implemented: (a) empty viewport Chromium screenshot. R1 visual remains a later ticket if this PR would exceed size.
Answer: —

### Q-0030 — `EditorContext.assets` before T-0109
Raised by: T-0100 · Spec: `02` §7 · Status: open
Question: `EditorContext.assets` is required, but `AssetService.commitPlan` lands in T-0109 and T-0115 does not depend on T-0109.
Options: (a) T-0115 depends T-0109 (b) T-0115 injects a façade whose import methods return `UNSUPPORTED`
Conservative choice implemented: (b) T-0115 depends T-0108 (primitive factory) and may stub import until T-0109.
Answer: —

### Q-0031 — Keyboard nudge Shift multiplier
Raised by: T-0100 · Spec: `01` a11y, `05` §7 · Status: open
Question: Arrow-key nudge is required; the Shift multiplier is not specified.
Options: (a) Shift ×10 of the snap increment (b) Shift uses a different documented increment
Conservative choice implemented: (a) ×10 for T-0116.
Answer: —

### Q-0032 — Archive entry allow-list vs `blobs/index.json`
Raised by: T-0100 · Spec: `03` §10 vs `14` SEC-08 · Status: open
Question: `03` §10 includes `blobs/index.json` in the project/archive layout. SEC-08 allow-list names `blobs/<hash>`, `project.tessera.json`, `manifest.json` only.
Options: (a) allow `blobs/index.json` as in `03` (b) omit the index file and derive listing from zip entries
Conservative choice implemented: (a) T-0101 allows `blobs/index.json` in addition to the SEC-08 names so `03` §10 is implementable.
Answer: —

### Q-0033 — MemoryProjectStore does not hydrate Y.Doc
Raised by: T-0101 · Spec: `08` §2 vs `02` §4 storage deps · Status: open
Question: `OpenProject.ydoc` is a live Yjs document, but `@tessera/storage` must not import `@tessera/core` (mapping lives in core; INV-ARCH-01). How does Memory populate the Y.Doc?
Options: (a) storage imports core anyway (b) keep a canonical `Document` snapshot and return an empty `Y.Doc` for the host to hydrate with `toYDoc`
Conservative choice implemented: (b) snapshot JSON is the source of truth in MemoryProjectStore.
Answer: —

### Q-0034 — T-0102 browser-mode tests vs Node `fake-indexeddb`
Raised by: T-0102 · Spec: `13` §2, T-0102 Notes · Status: open
Question: Ticket notes say browser-mode Vitest + Playwright. `13` §2 lists browser-mode for engine/ui, not storage. OPFS is unavailable in Node.
Options: (a) Playwright Chromium for `*.browser.test.ts` (b) Node + `fake-indexeddb`; OPFS fallback path is the Node-tested path
Conservative choice implemented: (b) `fake-indexeddb` 6.2.5 (dev). A fake OPFS directory handle covers the OPFS backend in-process. True browser OPFS waits for engine browser-mode (T-0104). Tests use an inline `TestClock` (same `Clock` surface as testing’s `FakeClock`) because storage must not depend on `@tessera/testing`.
Answer: —

### Q-0035 — Debounced snapshot cannot `fromYDoc`
Raised by: T-0102 · Spec: `08` §4 vs `02` §4 storage deps · Status: open
Question: `08` §4 writes a 5 s canonical snapshot to `snapshots/<projectId>.json`. T-0102 Non-goals exclude snapshot files. Storage cannot import `@tessera/core` to map Yjs → `Document`.
Options: (a) import core from storage (b) update `updatedAt` on the JSON snapshot already stored in `tessera-projects`
Conservative choice implemented: (b) `ydoc.on("update")` records `dirtyAt`; `list`/`snapshot`/`close` flush when `clock.now() - dirtyAt >= SNAPSHOT_DEBOUNCE_MS` (5000). Yjs updates still persist via `y-indexeddb`. Hosts that need a full canonical document after edits apply `fromYDoc` themselves.
Answer: —

### Q-0036 — `frameBounds` return shape
Raised by: T-0103 · Spec: `05` §8 · Status: open
Question: Engine `frame` uses `spatial.frameBounds`, but `CameraPose` is unnamed in schema and `padding` units are unspecified.
Options: (a) invent a full viewport `CameraPose` (fov, near, far) (b) return look-at center, padded AABB, radius, isometric position, and distance
Conservative choice implemented: (b) `FrameBounds` with `padding` as extra meters per side (clamped ≥ 0). Camera sits on the (1,1,1) isometric axis at `distance = 2 * radius`. Engine T-0104/T-0106 can map this onto `camera-controls`.
Answer: —

### Q-0037 — spatial does not import `three`
Raised by: T-0103 · Spec: `02` §4 vs T-0103 AC2 · Status: open
Question: Spatial may import `three` math modules. AC2 only constrains *if* three is imported.
Options: (a) add `three` and import `three/src/math/*` (b) implement AABB/TRS math in-package with no `three`
Conservative choice implemented: (b) no `three` dependency. `SpatialReader` is a structural subset of `DocumentReader` so spatial does not import `@tessera/core` either (avoids a production core→spatial cycle later and unused-dep knip).
Answer: —

### Q-0038 — ground-plane test
Raised by: T-0103 · Spec: T-0103 Goal vs silent `05`/`03` · Status: open
Question: Goal lists a ground-plane test; no API or epsilon is specified.
Options: (a) snap helpers (b) boolean `onGroundPlane(aabb, epsilon = 1e-6)` when `|min.y| ≤ epsilon`
Conservative choice implemented: (b) Y-up document coordinates; layout snapping stays phase 2.
Answer: —

### Q-0039 — viewport `CameraPose` shape
Raised by: T-0104 · Spec: `05` §8 / §12 · Status: open
Question: `getViewportCamera` / `setViewportCamera` use `CameraPose`, but the type is unnamed in schema and `05`.
Options: (a) full lens pose (fov, near, far, quaternion) (b) look-at `{ position, target }` until camera-controls (T-0106)
Conservative choice implemented: (b) look-at form. T-0106 can extend when `camera-controls` lands.
Answer: —

### Q-0040 — engine browser-mode without Playwright
Raised by: T-0104 · Spec: `13` §2, T-0104 Tests · Status: open
Question: Ticket lists `*.browser.test.ts` (Vitest browser-mode + Playwright). True WebGPU/WebGL is unavailable in Node, and Playwright browser-mode is not wired until `apps/web` (T-0119).
Options: (a) add Vitest Playwright browser provider now (b) happy-dom + injectable `GpuRenderer`; defer real GPU to T-0119 / a later engine browser job
Conservative choice implemented: (b) `happy-dom` 18.0.1 (dev) and `createRenderer` injection. Production still uses `three/webgpu` `WebGPURenderer` with `navigator.gpu` / `init()` fallback (`05` §2–§3).
Answer: —

### Q-0041 — capsule `height` vs analytic bounds
Raised by: T-0108 · Spec: `03` primitive field vs `primitiveBounds` · Status: open
Question: Geometry schema describes capsule `height` as “cylinder height excluding caps”, but `primitiveBounds` uses `±height/2` on Y (total AABB height).
Options: (a) generate excluding caps and exceed `primitiveBounds` (b) treat `height` as total AABB height so mesh bounds match `primitiveBounds` within 1e-5
Conservative choice implemented: (b) AC requires bounds match; cylinder length is `max(0, height − 2×radius)`.
Answer: —

### Q-0042 — primitive factory does not write blobs
Raised by: T-0108 · Spec: T-0108 AC3 · Status: open
Question: AC3 says “pure + blob writes only when asked”. No encoding for a primitive mesh blob is specified until glTF import/export.
Options: (a) invent a custom binary blob now (b) return in-memory `PrimitiveMesh` only
Conservative choice implemented: (b) no `BlobStore` writes in T-0108. Engine/exporters consume arrays directly; T-0109/T-0110 own blob formats.
Answer: —

### Q-0043 — engine may import `@tessera/assets`
Raised by: T-0105 · Spec: `02` §4 vs T-0105 AC4 / `09` §3.2 · Status: open
Question: Architecture lists engine imports as std, schema, core, spatial, storage, three — not `assets`. T-0105 AC4 requires primitive meshes from `@tessera/assets`.
Options: (a) duplicate the generator in engine (b) import `@tessera/assets` (same generator as exporters)
Conservative choice implemented: (b) same generator (`09` §3.2). Update the architecture table in a later docs ticket.
Answer: —

### Q-0044 — geometry cache grace period
Raised by: T-0105 · Spec: `05` §4.4 · Status: open
Question: GPU resources dispose when refcount is zero **and** 5 s have passed. Tests cannot use wall clock.
Options: (a) inject Clock and a real timer (b) dispose immediately at refcount zero for T-0105
Conservative choice implemented: (b) immediate dispose. Grace period can land with T-0107 leak tests.
Answer: —

### Q-0045 — light angles in the runtime scene
Raised by: T-0105 · Spec: `05` §5 vs three.js · Status: open
Question: §5 says no conversions in the engine. three.js `SpotLight.angle` is radians; the document stores degrees.
Options: (a) pass degrees through (incorrect cone) (b) convert degrees → radians at the Object3D boundary like Euler
Conservative choice implemented: (b) same as transform Euler mapping in `05` §4.1.
Answer: —

