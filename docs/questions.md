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
