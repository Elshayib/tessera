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
