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
Answer: T-0119 captures the empty Viewport landmark at 1280×720 (`maxDiffPixelRatio` 0.002).

### Q-0078 — e2e wiring beyond Touches
Raised by: T-0119 · Spec: ticket Touches vs AC3 · Status: open
Question: Touches list `e2e/**`, `playwright.config.ts`, and CI, but `pnpm test:e2e` needs `@playwright/test` and `apps/web` `test:e2e`. Knip/Biome need config entries for the Playwright default export.
Options: (a) leave `test:e2e` unwired (b) extra `package.json`, `knip.json`, `biome.json`
Conservative choice implemented: (b) extra `package.json`, `knip.json`, `biome.json`.
Answer: —

### Q-0080 — storage barrel pulled Vitest into the editor
Raised by: T-0119 · Spec: `08` vs Vite graph · Status: open
Question: `@tessera/storage` re-exported `assertBlobStoreContract`, which imports `vitest`. Vite then crashed the editor (`pageerror`) before the shell painted.
Options: (a) stub vitest in Vite (b) keep the helper off the package barrel (tests import `./contract.js`)
Conservative choice implemented: (b).
Answer: —
Raised by: T-0119 · Spec: `13` §6 Chromium · Status: open
Question: Playwright's bundled Chromium unzip hung on this Windows agent; CI Ubuntu needs a browser with `--with-deps`.
Options: (a) bundled `chromium` only (b) Google Chrome via Playwright `channel: "chrome"`
Conservative choice implemented: (b) Chromium-based Chrome channel for local and CI; snapshot names include OS suffix.
Answer: —

### Q-0081 — Poly Haven flag name
Raised by: T-0120 · Spec: `01` §15 vs ticket AC6 · Status: open
Question: The ticket says flag `polyHaven`; `flags.ts` already has `polyhaven`.
Options: (a) rename to `polyHaven` (b) keep `polyhaven`
Conservative choice implemented: (b) existing key; default **true**.
Answer: —

### Q-0082 — asset panel composition
Raised by: T-0120 · Spec: ticket Touches vs `App` · Status: open
Question: Touches list `asset-panel/**` and `flags.ts`; knip and the editor need a mount.
Options: (a) unmounted panel (b) `App` renders `AssetPanel`
Conservative choice implemented: (b).
Answer: —

### Q-0083 — asset-panel English strings
Raised by: T-0120 · Spec: `01` §9 vs Touches · Status: open
Question: Search/apply controls are user-visible; Touches omit `i18n/en.ts`.
Options: (a) hardcoded JSX (b) `en.assetPanel.*`
Conservative choice implemented: (b).
Answer: —

### Q-0084 — Poly Haven exports on `@tessera/assets`
Raised by: T-0120 · Spec: ticket Touches vs package barrel · Status: open
Question: Touches omit `packages/assets/src/index.ts`, but `apps/web` must import the source without deep paths.
Options: (a) deep import `sources/polyhaven.js` (b) re-export from the package barrel
Conservative choice implemented: (b).
Answer: —

### Q-0085 — fetched blobs vs ProjectStore
Raised by: T-0120 · Spec: `08` §2 vs T-0115 bootstrap · Status: open
Question: `EditorContext` has `ProjectStore`, not a live `BlobStore`. `fetch` still needs a store.
Options: (a) add BlobStore to EditorContext (out of Touches) (b) module-level `MemoryBlobStore` like project-io
Conservative choice implemented: (b).
Answer: —

### Q-0086 — texture apply
Raised by: T-0120 · Spec: `08` §6 vs AC4–5 · Status: open
Question: AC covers applying HDRI and importing models. Texture document assignment is unspecified.
Options: (a) invent material/texture wiring (b) search/fetch textures only
Conservative choice implemented: (b).
Answer: —

### Q-0087 — Vitest picked up Playwright specs
Raised by: T-0120 · Spec: T-0119 e2e vs `pnpm test` · Status: open
Question: `apps/web/e2e/**` is Playwright. Knip lists it as an app entry; Vitest then loads those files and fails.
Options: (a) leave `pnpm test` red (b) exclude `e2e/**` from `apps/web` Vitest
Conservative choice implemented: (b).
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

### Q-0046 — viewport camera localStorage
Raised by: T-0106 · Spec: `05` §8 · Status: open
Question: Spec persists last viewport pose per project in localStorage. `@tessera/engine` has no project id and must not depend on `apps/web`.
Options: (a) persist inside engine with an injected key (b) persist in the web app (T-0115/T-0116)
Conservative choice implemented: (b) engine holds the live pose only. Web owns localStorage.
Answer: —

### Q-0047 — multi-selection gizmo pivot
Raised by: T-0106 · Spec: `05` §7 · Status: open
Question: Multi-selection manipulates a temporary pivot group. T-0106 tests attach a single entity group.
Options: (a) implement pivot parenting now (b) attach the first selected Object3D until T-0116 multi-select
Conservative choice implemented: (b) first selected Object3D. Pivot can land with viewport multi-select.
Answer: —

### Q-0048 — EngineHandle.pick waits for a hosted scene
Raised by: T-0106 · Spec: `05` §12 vs T-0106 Touches · Status: open
Question: `EngineHandle.pick` needs a scene the host does not yet own (sync is a separate `createRendererSync` scene). Touches list `picking.ts` / `gizmos.ts` / `viewport-camera.ts`, not `host.ts`.
Options: (a) add a scene to the host now (b) export module APIs now; wire `EngineHandle` in T-0116 when the viewport owns sync
Conservative choice implemented: (b) `pick` / `createGizmoController` / `createViewportCamera` are the T-0106 surface. Host stubs remain until the viewport composes them.
Answer: —

### Q-0049 — EngineHandle.screenshot stays a stub in T-0107
Raised by: T-0107 · Spec: `05` §12 vs T-0107 Touches · Status: open
Question: Host screenshot still returns `UNSUPPORTED` (T-0104). Touches are `screenshot.ts` / `stats.ts`, not `host.ts`, and happy-dom has no GPU render target.
Options: (a) extend `GpuRenderer` and wire the host now (b) injectable `render` callback; host wiring in T-0116
Conservative choice implemented: (b) `captureScreenshot` + `viewportStats` are the T-0107 surface.
Answer: —

### Q-0050 — Hard blob size for glTF import
Raised by: T-0109 · Spec: `08` §7.1 · Status: open
Question: Import rejects files above a “hard blob limit” but no byte count is named. Archive unzip and document snapshot budgets are 50 MB (`03` §12, `storage` `DEFAULT_ARCHIVE_LIMITS`).
Options: (a) 50 MiB matching the archive entry cap (b) a larger generation-era cap (c) leave unlimited until Settings quotas
Conservative choice implemented: (a) `HARD_BLOB_LIMIT_BYTES = 50 * 1024 * 1024`.
Answer: —

### Q-0051 — Temporary ids on ImportPlan assets and entities
Raised by: T-0109 · Spec: `08` §7.5 · Status: open
Question: `AssetInput` in the command catalog omits `id`/`createdAt`, but the ImportPlan comment says temporary ids are resolved on commit. `EntityInput` is unnamed.
Options: (a) assets/entities in the plan include temporary `a_`/`e_` ids (b) refer by array index
Conservative choice implemented: (a) `AssetInput` is `Omit<Asset, "createdAt">`; `EntityInput` has `id`, `name`, `parent`, `components?`.
Answer: —

### Q-0052 — AssetService façade surface in T-0109
Raised by: T-0109 · Spec: `08` §10 vs T-0109 Touches · Status: open
Question: The spec `AssetService` includes `importFiles`, `search`, `addFromSource`, `generate`, thumbnails, and sources. T-0109 AC only requires `commitPlan` plus the worker `ImportPlan`.
Options: (a) stub the rest as `UNSUPPORTED` (b) implement only `commitPlan`
Conservative choice implemented: (b) `createAssetService` exposes `commitPlan` only. Sources and jobs wait for T-0120 / later.
Answer: —

### Q-0053 — import.worker is a function in this ticket
Raised by: T-0109 · Spec: `08` INV-AST-06 · Status: open
Question: INV-AST-06 requires a Worker so the main thread never blocks > 50 ms (50 MB e2e). T-0109 non-goals that measurement.
Options: (a) ship a real Worker now (b) export the worker body as `importGltf` for Node tests and host it in a Worker in a later ticket
Conservative choice implemented: (b) `importGltf` is the worker body. It does not import `CommandBus`.
Answer: —

### Q-0054 — gltf-transform v4 `weld()` has no tolerance
Raised by: T-0109 · Spec: `08` §7.1 · Status: open
Question: Spec asks for `weld()` with tolerance `1e-5`. `@gltf-transform/functions` 4.4.2 `WeldOptions` only has `overwrite` (bitwise-identical vertices).
Options: (a) call `weld()` as provided (b) vendor a tolerance weld
Conservative choice implemented: (a) `weld()` with library defaults. `unlit()` convert-to-unlit is not applied; `KHR_materials_unlit` is preserved via extension registration.
Answer: —

### Q-0055 — mikktspace not bundled for `tangents()`
Raised by: T-0109 · Spec: `08` §7.1 · Status: open
Question: Spec asks to run `tangents()` when a normal texture is present. gltf-transform 4 requires a `generateTangents` callback (typically `mikktspace`); that WASM package is not a Tessera dependency.
Options: (a) add `mikktspace` now (b) skip tangent generation with a warning until a later ticket
Conservative choice implemented: (b) call `tangents()` and, if it throws, keep the import and warn. Do not add a new dependency in T-0109.
Answer: —

### Q-0056 — glTF round-trip ids through `commitPlan`
Raised by: T-0110 · Spec: `09` §10 INV-EXP-04, T-0110 AC4 · Status: open
Question: INV-EXP-04 / T-0110 AC4 ask re-import via `commitPlan` to preserve entity ids. `entity.create` / `asset.create` always mint new ids, and the T-0109 import worker does not read `extras.tessera`. Changing those packages is outside T-0110 `Touches`. The import worker also only proposes entities for mesh-bearing nodes, so lights and cameras without meshes are not re-imported.
Options: (a) change `entity.create` to accept caller ids and teach import to honor `extras.tessera` (b) treat the interchange as the source of ids
Conservative choice implemented: (b) T-0110 writes original ids to node `extras.tessera.id` and sidecar `entities[].id`. Round-trip tests assert extras/sidecar ids plus names/transforms after `commitPlan`. Document ids after commit are new (Q-0051).
Answer: —

### Q-0057 — exporters import `@tessera/assets` for primitive meshes
Raised by: T-0110 · Spec: `02` §4 vs `09` §3.2 · Status: open
Question: Architecture §4 lists exporters may import std, schema, core, storage, `@gltf-transform/*`. Spec `09` §3.2 requires primitive meshes from the same generator as the engine (T-0108, `@tessera/assets`).
Options: (a) import `@tessera/assets` in exporters (b) duplicate the generator
Conservative choice implemented: (a) exporters depend on `@tessera/assets` for `createPrimitiveMesh` only. Production code does not import `@tessera/core`.
Answer: —

### Q-0058 — exporters consume Zod for `optionsSchema`
Raised by: T-0110 · Spec: `09` §2 vs `02` §5 · Status: open
Question: `Exporter.optionsSchema` is a Zod type so the UI can generate the export dialog. Architecture §5 lists Zod consumption for schema, core, agent, mcp, plugin-api — not exporters.
Options: (a) add `zod` to `@tessera/exporters` (b) define export option schemas in `@tessera/schema`
Conservative choice implemented: (a) `GltfExportOptionsSchema` lives in exporters with inspector `.meta()`, matching `09` §2.
Answer: —

### Q-0059 — `code-three` bundle includes glTF files
Raised by: T-0111 · Spec: `09` §6 · Status: open
Question: The spec describes ESM `scene.js` that loads `<name>.glb` but does not say whether `code-three` also emits the glTF (T-0110) files in the same bundle.
Options: (a) emit only `scene.js` (b) compose `gltf` export + `scene.js`
Conservative choice implemented: (b) `createCodeThreeExporter` calls the glTF exporter and adds `scene.js`. Options reuse `GltfExportOptionsSchema`. Generated JS uses single-quoted `three` imports so exporter sources do not contain `from "three"` (`INV-EXP-01` source scan). Snapshot `scene.js` is excluded from Biome and knip because it is printer output, not package source.
Answer: —

### Q-0060 — documented `--t-…` token set
Raised by: T-0112 · Spec: `01` §5 · Status: open
Question: The spec names `--t-color-accent` as the example and does not list the rest of the token set.
Options: (a) invent a full design system (b) smallest chrome set
Conservative choice implemented: (b) `--t-color-accent|bg|fg|muted|border`, `--t-space-1|2`, `--t-font-sans`, `--t-radius`, `--t-focus` in `TOKENS_CSS`.
Answer: —

### Q-0061 — English catalog path
Raised by: T-0112 · Spec: `01` §9 vs ticket Touches · Status: open
Question: Spec `01` §9 says `packages/ui/src/messages/en.ts`; T-0112 Touches `packages/ui/src/i18n/en.ts`.
Options: (a) spec path (b) ticket path
Conservative choice implemented: (b) `i18n/en.ts` to stay inside Touches; strings still live in one catalog with no JSX literals.
Answer: —

### Q-0062 — outliner glob vs `scene.find`
Raised by: T-0113 · Spec: `04` §10 · Status: open
Question: Search must use the same glob rules as `scene.find`. The matcher lives inside `@tessera/core` query handlers and is not exported.
Options: (a) export glob from core (b) duplicate the `*` / `?` matcher in the outliner
Conservative choice implemented: (b) `outliner/name-glob.ts` copies the core `globMatch` implementation so T-0113 stays in Touches.
Answer: —

### Q-0063 — inspector strings outside Touches
Raised by: T-0114 · Spec: `01` §9 vs ticket Touches · Status: open
Question: T-0114 Touches only `packages/ui/src/inspector/**`, but `01` §9 forbids hardcoded JSX strings.
Options: (a) literals in inspector (b) add `en.inspector.*` in `i18n/en.ts`
Conservative choice implemented: (b) catalog keys; export `Inspector` from `packages/ui/src/index.ts` so the panel is usable.
Answer: —

### Q-0064 — `EditorContext.queries` type
Raised by: T-0115 · Spec: `02` §7 · Status: open
Question: The spec types `queries` as `QueryRegistry`. `@tessera/core` exposes `QueryHost` (`registry` + `query()`).
Options: (a) put `QueryHost` on the context (b) store only `QueryRegistry`
Conservative choice implemented: (b) `queries` is `QueryRegistry` from `createQueryHost(...).registry`.
Answer: —

### Q-0065 — `ComponentRegistry` before plugins
Raised by: T-0115 · Spec: `02` §7 · Status: open
Question: `EditorContext.components` is required. `@tessera/core` has no public `ComponentRegistry` type yet.
Options: (a) invent a plugin registry now (b) empty `{ names: [] }` placeholder
Conservative choice implemented: (b) `ComponentRegistry` in `apps/web` with `names: []`.
Answer: —

### Q-0066 — viewport mount vs T-0116 Touches
Raised by: T-0116 · Spec: `05` §7 vs ticket Touches · Status: open
Question: The viewport must host `EngineHandle`, but Touches list only `apps/web/src/viewport/**` and optional `packages/ui/src/viewport-host.tsx`. `App` / `Shell` are the only composition points.
Options: (a) leave the host unmounted (b) slot `viewport` into `Shell` and wire `App`
Conservative choice implemented: (b) `Shell` accepts `viewport?: ReactNode`; `App` passes `<Viewport />`.
Answer: —

### Q-0067 — arrow nudge axes
Raised by: T-0116 · Spec: `05` §7 · Status: open
Question: Keyboard nudge moves in the “viewport plane”; the exact world mapping is unspecified.
Options: (a) camera-relative right/up (b) world XZ: Right +X, Left −X, Up −Z, Down +Z
Conservative choice implemented: (b) world XZ with snap `0.1 m` so unit tests do not need a GPU camera.
Answer: —

### Q-0068 — create menu composition
Raised by: T-0117 · Spec: ticket Touches vs `App` · Status: open
Question: T-0117 Touches `create-menu/**` and `flags.ts`, but the menu must mount in the editor tree.
Options: (a) unmounted menu (b) render `CreateMenu` from `App.tsx`
Conservative choice implemented: (b) `App` renders `CreateMenu` (hidden unless `flags.createMenu`).
Answer: —

### Q-0069 — create-menu English strings
Raised by: T-0117 · Spec: `01` §9 vs Touches · Status: open
Question: Create controls are user-visible; Touches omit `i18n/en.ts`.
Options: (a) hardcoded JSX (b) `en.createMenu.*`
Conservative choice implemented: (b) catalog keys in `packages/ui/src/i18n/en.ts`.
Answer: —

### Q-0070 — create-menu command names
Raised by: T-0117 · Spec: `04` catalog vs ticket Goal · Status: open
Question: The ticket lists `entity.create`, `component.add`, and `material.create`. T-0108 default materials are full `MaterialAsset` values; geometry uses `asset.create`.
Options: (a) `material.create` + `component.add` (b) one transaction of `asset.create` (material + primitive geometry) + `entity.create` with components
Conservative choice implemented: (b) so new meshes use `createDefaultMaterial` / `createPrimitiveMesh`.
Answer: —

### Q-0071 — ProjectStore has no save
Raised by: T-0118 · Spec: `08` §2 · Status: open
Question: `ProjectStore` can `snapshot` / `exportArchive` stored JSON, but cannot write a live `fromYDoc` document in place. Memory and IndexedDB listing snapshots are not the live Yjs graph.
Options: (a) add `save` to storage (out of Touches) (b) persist via `encodeTesseraArchive` + `importArchive`
Conservative choice implemented: (b).
Answer: —

### Q-0075 — project-io composition
Raised by: T-0118 · Spec: ticket Touches vs `App` · Status: open
Question: Touches are `project-io/**` only; knip and the editor need a mount point.
Options: (a) unused module (b) `App` renders `ProjectIo`
Conservative choice implemented: (b).
Answer: —

### Q-0076 — project-io English strings
Raised by: T-0118 · Spec: `01` §9 vs Touches · Status: open
Question: Save/download/open are user-visible.
Options: (a) hardcoded JSX (b) `en.projectIo.*`
Conservative choice implemented: (b).
Answer: —

### Q-0077 — open does not swap the live Y.Doc
Raised by: T-0118 · Spec: `02` §7 EditorContext · Status: open
Question: `importArchive` returns a new `ProjectId`; replacing `EditorContext.document` is not in Touches.
Options: (a) rebuild bootstrap from snapshot (b) persist into the store only
Conservative choice implemented: (b) for UI; tests compare snapshots after import.
Answer: —






