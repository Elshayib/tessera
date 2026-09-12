# Phase 3 — Assets and generation

Milestone: `m3-assets` · Depends on T-0215
Tickets below were frozen by **T-0300**. Do not implement T-0301+ until T-0300 is `done`.

| Id | Title | Package | Depends | Status |
| --- | --- | --- | --- | --- |
| T-0300 | Freeze phase-3 tickets | docs | T-0215 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0301 | Asset panel + uploads UX | ui, assets, web | T-0300 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0302 | Poly Haven façade/apply remaining (not a second source) | assets, web | T-0120, T-0301 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0303 | Thumbnails worker | assets | T-0301 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0304 | `@tessera/generation` interfaces + job kinds | generation, testing | T-0300 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0305 | Providers: Meshy, Tripo, Rodin, HF TRELLIS.2, local worker contract | providers-generation | T-0304 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0306 | Job UI + progress + cancel; agent tier-3 tools | ui, agent, assets | T-0305, T-0008 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0307 | KTX2/Draco import/export options | assets, exporters | T-0109 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0308 | Attribution/license export | exporters | T-0302 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |
| T-0309 | Kenney source (Draft — Q-0003) | assets | Q-0003 answered | `blocked` |
| T-0310 | Phase 3 exit: score `core.generate-barrel` | evals | T-0306 | `done` ([#66](https://github.com/Elshayib/tessera/pull/66)) |

## Specs

`08-assets-and-storage.md`, `07-providers.md` §8–§11, `06` §5, `09` §3.1/§9, `13` §3/§5.4, `17` phase 3, Q-0003.

## Hard rules for implementers

- Generation vendor SDKs and hardcoded vendor URLs live only in `@tessera/providers-generation` (`INV-PRV-01`).
- Import never mutates the document; commit through the command bus in one transaction (`INV-AST-02`).
- No network in CI tests or replay evals; recorded fixtures, `FakeGenerationProvider`, and in-process fake workers only.
- T-0302 must not reimplement `createPolyHavenSource` (T-0120). Kenney (T-0309) stays blocked.

---

# T-0300 — Freeze phase-3 tickets (fill AC/Tests for T-0301+)

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `docs/tasks` |
| Size | M |
| Depends on | T-0215 (`done`) |
| Status | `done` |

## Goal

Every phase-3 implementation ticket T-0301–T-0308 and T-0310 has Goal, Context, Touches, acceptance criteria, Tests, and Non-goals at the same depth as phase-0 tickets, copied from specs (not invented). T-0309 stays `blocked` on unanswered Q-0003.

## Context

- Spec: `docs/18-implementation-playbook.md` §4 (do not start a ticket that lacks AC)
- Template: `docs/templates/task-template.md`
- Index: `docs/tasks/README.md` (first ticket of a phase freezes later tickets)
- Roadmap: `docs/17-roadmap.md` phase 3 (`m3-assets`)
- T-0120 already shipped Poly Haven `hdri|model|texture` search/fetch (Q-0171)

## Touches

```
docs/tasks/phase-3.md
scripts/check-phase-3-tickets.test.ts
docs/questions.md
```

## Acceptance criteria

1. T-0301 through T-0308 and T-0310 each have a `# T-0NNN —` heading plus Goal, Context, Touches, Acceptance criteria, Tests, Non-goals.
2. No T-0301–T-0308 or T-0310 ticket is a draft stub waiting to be expanded.
3. Touches and AC cite the linked spec sections; silent spots go in `docs/questions.md`.
4. T-0302 is narrowed to remaining façade/UX/apply gaps; it does not invent a second Poly Haven source (T-0120 overlap, Q-0171).
5. T-0309 remains `blocked` and cites Q-0003.
6. A unit test fails if any of those sections is missing.

## Tests

| Test | File |
| --- | --- |
| `'T-0301–T-0308 and T-0310 have Goal, Context, Touches, AC, Tests, Non-goals'` | `scripts/check-phase-3-tickets.test.ts` |
| `'T-0309 stays blocked on Q-0003'` | `scripts/check-phase-3-tickets.test.ts` |

## Non-goals

Implementing any package. Opening PRs for T-0301+. Git-tagging `m3-assets`. Filling phase-4+ tickets. Answering Q-0003. Finishing leftover T-0225.

## Notes for the implementing agent

Copy interfaces from `07` §8 and `08` §6–§10 as written. Do not rename.

---

# T-0301 — Asset panel + uploads UX

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/assets`, `@tessera/ui`, `apps/web` |
| Size | L |
| Depends on | T-0300 |
| Status | `done` |

## Goal

`AssetService` from `08` §10 exposes `importFiles`, `search`, `addFromSource`, `listUnused`, `sources`, and still `commitPlan`. Local uploads go through the import pipeline and commit in one transaction (`INV-AST-02`). The editor asset panel can upload glb/gltf, png/jpg/webp/ktx2, hdr/exr with a license nudge (uploads default `unknown`, `08` §8).

## Context

- Spec: `docs/08-assets-and-storage.md` §6 (Uploads), §7, §8, §10, INV-AST-02/04
- T-0109: `commitPlan` + `importGltf` exist (Q-0052)
- T-0120: Poly Haven source + panel search exist; this ticket adds the façade and upload UX, not a new source
- Architecture: `docs/02-architecture.md` §4–§5 (`assets` may import std, schema, core, storage, gltf-transform)
- `generate` and thumbnails are T-0306 / T-0303

## Touches

```
packages/assets/src/asset-service.ts
packages/assets/src/asset-service.test.ts
packages/assets/src/sources/registry.ts
packages/assets/src/sources/registry.test.ts
packages/assets/src/import-files.ts
packages/assets/src/import-files.test.ts
packages/assets/src/index.ts
packages/assets/README.md
packages/ui/src/i18n/en.ts
apps/web/src/asset-panel/asset-panel.tsx
apps/web/src/asset-panel/uploads.ts
apps/web/src/asset-panel/uploads.test.ts
apps/web/src/flags.ts
docs/questions.md
.changeset/t-0301-asset-uploads.md
```

## Acceptance criteria

1. Public `AssetService` matches `08` §10 as written for this ticket: `importFiles`, `search`, `addFromSource`, `listUnused`, `sources`, `commitPlan`. `generate` and `thumbnails` may return `UNSUPPORTED` / `null` until T-0306 / T-0303 (Q-0172).
2. `importFiles(files, options, signal)` enqueues one import `JobSpec` per file on the existing `JobQueue` (`04` §9). The worker body produces an `ImportPlan`; `commit` calls `commitPlan` in exactly one transaction labeled `Import <fileName>` (`INV-AST-02`).
3. Uploads: glb/gltf via `importGltf`; png/jpg/webp/ktx2 as texture assets (`08` §7.2, store original bytes); hdr/exr as environment (`08` §7.3). FBX/OBJ/USD/BLEND → `UNSUPPORTED` with the Blender-bridge hint (`08` §7.4). Reject > `HARD_BLOB_LIMIT_BYTES`.
4. Upload `license` defaults to `unknown`; the panel nudges the user to set it (`08` §8). Library assets from sources still carry `license` ≠ `unknown` (`INV-AST-04`).
5. `search` / `addFromSource` delegate to `AssetSourceRegistry.get(sourceId)`; missing source → `NOT_FOUND`. `addFromSource` is a job: fetch → import pipeline → `commitPlan` (`INV-AST-02`).
6. Feature-flag new upload chrome (`01` §15, `apps/web/src/flags.ts`) until this ticket turns it on. Coverage ≥ 85% on touched asset modules. Changeset. TSDoc on public exports. README updated.

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-02 importFiles commits ImportPlan in one transaction'` | `packages/assets/src/import-files.test.ts` |
| `'INV-AST-02 addFromSource commits through command bus once'` | `packages/assets/src/asset-service.test.ts` |
| `'uploads default license unknown; source assets license ≠ unknown'` | `packages/assets/src/import-files.test.ts` |
| `'UNSUPPORTED extensions return UNSUPPORTED with convert hint'` | `packages/assets/src/import-files.test.ts` |
| `'search missing source → NOT_FOUND'` | `packages/assets/src/sources/registry.test.ts` |
| `'upload input is present in the asset panel'` | `apps/web/src/asset-panel/uploads.test.ts` |

## Non-goals

Thumbnails GPU (T-0303). `AssetService.generate` (T-0306). Poly Haven texture apply (T-0302). Kenney. Sketchfab. INV-AST-06 50 MB main-thread e2e. Generation providers.

## Notes for the implementing agent

Do not invent a second `AssetSource` for uploads; uploads are local files (`08` §6 table). Inject `JobQueue`, `BlobStore`, `Clock`, and sources. Tests use in-memory stores and never hit the network.

---

# T-0302 — Poly Haven façade/apply remaining (not a second source)

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/assets`, `apps/web` |
| Size | M |
| Depends on | T-0120 (`done`), T-0301 |
| Status | `done` |

## Goal

Users and agents search/add Poly Haven `model` / `texture` / `hdri` through `AssetService.search` / `addFromSource`. Texture apply is no longer a no-op (Q-0086 closed). Fetched library assets carry `license` ≠ `unknown` and full provenance (`INV-AST-04`). T-0120's `createPolyHavenSource` is reused, not rewritten.

## Context

- Spec: `docs/08-assets-and-storage.md` §6 Poly Haven row, §10 agent tools, INV-AST-02/04
- T-0120: source already searches `hdri|model|texture` against `https://api.polyhaven.com` (`/assets?t=models|textures|hdris`, `/files/{id}`), CC0-1.0, recorded fixtures
- Q-0086: T-0120 searched/fetched textures but did not assign them in the document
- Q-0171: this ticket is remaining apply/façade gaps

## Touches

```
packages/assets/src/asset-service.ts
packages/assets/src/asset-service.test.ts
packages/assets/src/apply-fetched.ts
packages/assets/src/apply-fetched.test.ts
packages/assets/src/sources/polyhaven.ts
packages/assets/src/sources/polyhaven.test.ts
apps/web/src/asset-panel/apply-source.ts
apps/web/src/asset-panel/apply-source.test.ts
apps/web/src/asset-panel/asset-panel.tsx
docs/questions.md
.changeset/t-0302-polyhaven-apply.md
```

## Acceptance criteria

1. `AssetService.search('polyhaven', query)` and `addFromSource('polyhaven', item, options)` are the only editor/agent entry points; they call the existing `createPolyHavenSource` (`08` §6). No second source id.
2. Recorded-fixture tests cover `kind: 'hdri' | 'model' | 'texture'` search, pagination, and fetch. No network (`INV-TST-01`).
3. `addFromSource` for `model` runs `importGltf` then `commitPlan` (`INV-AST-02`). For `hdri`, creates an environment asset and may set `environment.sky` when requested. For `texture`, creates texture (+ optional material) assets and applies them to the selected mesh's material slots — no longer a no-op (Q-0086, Q-0173).
4. `INV-AST-04`: committed library assets have `license` ≠ `unknown` (CC0-1.0) and provenance with `source`, `sourceId` or job id, `importedAt`.
5. Search free-text stays wrapped in `<untrusted>` (`06` §12, existing `wrapUntrusted`).
6. Changeset. README notes the façade, not a new source.

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-04 polyhaven addFromSource sets license and provenance'` | `packages/assets/src/apply-fetched.test.ts` |
| `'texture apply creates texture asset and is not a no-op'` | `packages/assets/src/apply-fetched.test.ts` |
| `'hdri / model / texture search against recorded fixtures'` | `packages/assets/src/sources/polyhaven.test.ts` |
| `'INV-AST-02 addFromSource is one command-bus transaction'` | `packages/assets/src/asset-service.test.ts` |

## Non-goals

Rewriting `createPolyHavenSource`. Kenney. Sketchfab. Thumbnails. Generation. KTX2 encode.

## Notes for the implementing agent

Keep Poly Haven HTTP behind the existing injected transport. Texture apply: create `texture` assets from fetched maps and `material.update` / `asset.create` material with those slots when a target entity is in `CommitOptions` (Q-0173). Do not invent Sketchfab.

---

# T-0303 — Thumbnails worker

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/assets` |
| Size | M |
| Depends on | T-0301 |
| Status | `done` |

## Goal

`ThumbnailService.get(assetId)` returns a cached 256×256 WebP blob at `derived:thumb:<assetId>:<hash>` rendered by an injected engine offscreen pass, or `null` when headless (`08` §9).

## Context

- Spec: `docs/08-assets-and-storage.md` §9–§10
- Architecture: `assets` must not import `three`; the renderer is injected (Q-0174)
- Headless CLI/evals have no engine

## Touches

```
packages/assets/src/thumbnails.ts
packages/assets/src/thumbnails.test.ts
packages/assets/src/asset-service.ts
packages/assets/src/index.ts
packages/assets/README.md
docs/questions.md
.changeset/t-0303-thumbnails.md
```

## Acceptance criteria

1. `ThumbnailService` is `{ get(assetId: AssetId, signal?: AbortSignal): Promise<BlobRef | null> }` as used by `08` §9–§10.
2. Headless (no renderer injected): `get` returns `null`. UI shows a kind icon (panel already can; do not invent new icon art).
3. With an injected renderer: render 256×256 WebP, write to the blob store, cache key `derived:thumb:<assetId>:<hash>` where `hash` is the source blob hash (or asset content hash when there is no blob).
4. Second `get` for the same asset+hash does not re-render (cache hit).
5. `AssetService.thumbnails` is this service. Coverage ≥ 85%. Changeset. TSDoc.

## Tests

| Test | File |
| --- | --- |
| `'headless ThumbnailService.get returns null'` | `packages/assets/src/thumbnails.test.ts` |
| `'injected renderer caches derived:thumb:<assetId>:<hash>'` | `packages/assets/src/thumbnails.test.ts` |
| `'cache hit does not re-render'` | `packages/assets/src/thumbnails.test.ts` |

## Non-goals

GPU studio lighting quality. Browser visual baselines. INV-AST-06. Job UI.

## Notes for the implementing agent

Define a tiny `ThumbnailRenderer` interface in `@tessera/assets` (returns WebP bytes). `apps/web` may wire engine later; this ticket only needs the interface + cache. Do not import `@tessera/engine` from `assets` (`02` §5).

---

# T-0304 — `@tessera/generation` interfaces + testing fakes

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/generation`, `@tessera/testing` |
| Size | M |
| Depends on | T-0300 |
| Status | `done` |

## Goal

Layer-1 `@tessera/generation` exists with the `07` §8 types (`GenerationProviderDescriptor`, `GenerationRequest`, `GenerationResult`, `GenerationProvider`) and no vendor SDK (`INV-PRV-01`). `@tessera/testing` exports `FakeGenerationProvider` and `FakeAssetSource` as named in `13` §3.

## Context

- Spec: `docs/07-providers.md` §8, §10–§11; `docs/13-testing-and-evals.md` §3
- Architecture: `docs/02-architecture.md` §4 (`generation` may import std, schema)
- Playbook: `docs/18-implementation-playbook.md` §7 new-package checklist
- ADR-0007 pattern: interfaces here, adapters in `providers-generation`

## Touches

```
packages/generation/package.json
packages/generation/tsconfig.json
packages/generation/vitest.config.ts
packages/generation/README.md
packages/generation/src/index.ts
packages/generation/src/types.ts
packages/generation/src/types.test.ts
packages/generation/src/index.test.ts
packages/testing/src/fake-generation-provider.ts
packages/testing/src/fake-generation-provider.test.ts
packages/testing/src/fake-asset-source.ts
packages/testing/src/fake-asset-source.test.ts
packages/testing/src/index.ts
packages/testing/package.json
packages/testing/tsconfig.json
packages/testing/README.md
tsconfig.json
knip.json
vitest.config.ts
docs/questions.md
.changeset/t-0304-generation.md
```

## Acceptance criteria

1. Public types match `07` §8 as written: descriptor ids `'meshy' | 'tripo' | 'rodin' | 'hf-trellis2' | 'local-worker' | plugin ids`; request kinds `mesh | texture | environment | image`; `GenerationProvider` methods `estimate`, `submit`, `poll`, `fetchResult`, optional `cancel`. Layer 0–2 returns `Result`. `AbortSignal` on `submit` / `poll` / `fetchResult`.
2. `INV-PRV-01`: `@tessera/generation` does not depend on vendor SDKs or hardcode vendor URLs. README states the layer-1 import rule.
3. New-package checklist (`18` §7): `exports` only `"."`. Root `tsconfig.json` reference. Coverage ≥ 85% (`01` §7). Changeset. TSDoc with `@example` on non-trivial exports.
4. `FakeGenerationProvider` (`13` §3): deterministic job/search-adjacent generate behavior with configurable latency and failures; never hits the network.
5. `FakeAssetSource` (`13` §3): deterministic `search` / `fetch` with configurable latency and failures; implements `08` §6 `AssetSource`.
6. Re-export fakes from `@tessera/testing`. Testing may import `@tessera/generation` (Q-0175).

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-01 generation has no vendor SDK dependency'` | `packages/generation/src/types.test.ts` |
| `'GenerationRequest kinds match 07 §8'` | `packages/generation/src/types.test.ts` |
| `'FakeGenerationProvider estimate/submit/poll/fetchResult/cancel'` | `packages/testing/src/fake-generation-provider.test.ts` |
| `'FakeGenerationProvider configurable failure maps to TesseraError'` | `packages/testing/src/fake-generation-provider.test.ts` |
| `'FakeAssetSource search/fetch deterministic'` | `packages/testing/src/fake-asset-source.test.ts` |

## Non-goals

Meshy/Tripo/Rodin/HF/local adapters (T-0305). Job UI. Agent tools. Dockerfile.

## Notes for the implementing agent

Copy field names and literals from `07` §8. Do not import `@tessera/core`, `yjs`, React, or `three`. Omit `packages/generation` from the root Vitest 95% mix the same way as `@tessera/llm` (Q-0133 follow-up, Q-0176).

---

# T-0305 — Providers: Meshy, Tripo, Rodin, HF TRELLIS.2, local worker

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/providers-generation` |
| Size | L |
| Depends on | T-0304 |
| Status | `done` |

## Goal

Layer-2 `@tessera/providers-generation` implements `GenerationProvider` for Meshy, Tripo, Rodin, Hugging Face Space (TRELLIS.2), and the local worker HTTP contract (`07` §8.2–§8.3). A reference Dockerfile wrapping TRELLIS.2 lives under `bridges/generation-worker/`. Vendor SDKs and hardcoded vendor URLs live only in this package (`INV-PRV-01`).

## Context

- Spec: `docs/07-providers.md` §8.2–§8.3, §9, INV-PRV-01/02/03/05, §11
- Architecture: `docs/02-architecture.md` §4–§5 (`providers-generation` may import std, generation, storage)
- Security: `docs/14-security-threat-model.md` SEC-02, SEC-04
- Local worker contract is public; adapters inject HTTP so tests use recorded fixtures / in-process fake worker

## Touches

```
packages/providers-generation/package.json
packages/providers-generation/tsconfig.json
packages/providers-generation/vitest.config.ts
packages/providers-generation/README.md
packages/providers-generation/src/index.ts
packages/providers-generation/src/map-provider-error.ts
packages/providers-generation/src/map-provider-error.test.ts
packages/providers-generation/src/create-meshy-provider.ts
packages/providers-generation/src/create-tripo-provider.ts
packages/providers-generation/src/create-rodin-provider.ts
packages/providers-generation/src/create-hf-trellis2-provider.ts
packages/providers-generation/src/create-local-worker-provider.ts
packages/providers-generation/src/generation-provider-contract.test.ts
packages/providers-generation/src/*.test.ts
packages/providers-generation/fixtures/
bridges/generation-worker/Dockerfile
bridges/generation-worker/README.md
.dependency-cruiser.cjs
tsconfig.json
knip.json
docs/questions.md
.changeset/t-0305-providers-generation.md
```

## Acceptance criteria

1. Each `07` §8.2 adapter exports `createXxxProvider(config, deps): GenerationProvider`. Descriptor ids are `'meshy' | 'tripo' | 'rodin' | 'hf-trellis2' | 'local-worker'`.
2. `INV-PRV-01`: only this package hardcodes generation vendor URLs or imports a generation vendor SDK. Depcruise forbids those imports from every other package.
3. Local worker implements `07` §8.3: `POST /v1/jobs` → 202 `{ id }`; `GET /v1/jobs/{id}` → `{ state, progress, message }`; `GET /v1/jobs/{id}/result` multipart; `DELETE /v1/jobs/{id}` → 204; `GET /v1/capabilities` → descriptor. Optional bearer token.
4. HF TRELLIS.2: image-to-3D via Gradio HTTP; text prompts are a two-stage job through an image provider first (`07` §8.2).
5. `INV-PRV-02`: clients hold `apiKeyRef`, not the secret. Missing key → `PERMISSION_DENIED`.
6. `INV-PRV-03`: vendor failures map to `TesseraError` (401/403 `PERMISSION_DENIED`; 404 `NOT_FOUND`; 429 `RATE_LIMITED` + `retryAfterMs`; timeout `TIMEOUT`; abort `CANCELLED`; 5xx/network `PROVIDER_ERROR`). Raw vendor bodies are not copied onto the error.
7. Recorded-fixture tests per adapter for `estimate` / `submit` / `poll` / `fetchResult` / `cancel`. Local worker contract tests against an in-process fake worker. No live Meshy/Tripo/Rodin/HF calls in CI.
8. `bridges/generation-worker/` contains a Dockerfile wrapping TRELLIS.2 (Python, permissive license) plus a short README. The image is not built in CI.
9. Split the PR if it exceeds ~600 loc excluding tests/fixtures and record the split in this file. Coverage ≥ 85%. Changeset. Pin new deps in the PR **New dependencies** section.

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-01 only providers-generation hardcodes vendor URLs'` | `packages/providers-generation/src/index.test.ts` |
| `'INV-PRV-03 HTTP 401/403 → PERMISSION_DENIED'` | `packages/providers-generation/src/map-provider-error.test.ts` |
| `'Meshy estimate/submit/poll/fetchResult/cancel against fixtures'` | `packages/providers-generation/src/create-meshy-provider.test.ts` |
| `'Tripo recorded fixture round-trip'` | `packages/providers-generation/src/create-tripo-provider.test.ts` |
| `'Rodin recorded fixture round-trip'` | `packages/providers-generation/src/create-rodin-provider.test.ts` |
| `'HF TRELLIS.2 two-stage text-to-mesh job'` | `packages/providers-generation/src/create-hf-trellis2-provider.test.ts` |
| `'local worker 07 §8.3 contract against in-process fake'` | `packages/providers-generation/src/create-local-worker-provider.test.ts` |
| `'Dockerfile exists under bridges/generation-worker/'` | `packages/providers-generation/src/index.test.ts` |

## Non-goals

Live smoke in CI. Wiring `AssetService.generate` (T-0306). Job UI. Kenney. Hunyuan3D beyond surfacing regional-restriction notes in capabilities (Q-0177).

## Notes for the implementing agent

Inject fetch/transport. Do not import `@tessera/assets` (generation results enter the document only through the import pipeline in T-0306, `INV-PRV-05`). Vendor URLs belong in this package only.

---

# T-0306 — Job UI + progress + cancel; agent tier-3 tools

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/ui`, `@tessera/agent`, `@tessera/assets` |
| Size | L |
| Depends on | T-0305, T-0008 (`done`) |
| Status | `done` |

## Goal

Import and generate run as jobs with progress and cancel. The editor shows job progress and can cancel. Agent tier-3 tools `asset.search`, `asset.add`, `asset.generateMesh`, `asset.generateTexture`, `asset.generateEnvironment`, `asset.import`, and `jobs.await` return `{ jobId, etaSeconds }` (`jobs.await` timeout cap ≤ 120000 ms). The runtime injects a `job.updated` note when a job finishes (`06` §5). `AssetService.generate` wraps a provider in a `generate` `JobSpec` (`07` §8.1) and commits through the import pipeline with license + provenance (`INV-PRV-05`).

## Context

- Spec: `docs/06-agent-runtime.md` §5; `docs/07-providers.md` §8.1, INV-PRV-05; `docs/08-assets-and-storage.md` §10; `docs/04-command-bus.md` §9 JobQueue
- T-0205 omitted tier ≥ 3 (`shouldOmitTool`)
- Q-0126: phase-2 `enabledTiers` was `[0,1,2]`; phase 3 includes 3 (Q-0178)
- Feature-flag new job chrome until this ticket turns it on

## Touches

```
packages/assets/src/asset-service.ts
packages/assets/src/generate.ts
packages/assets/src/generate.test.ts
packages/agent/src/tools/derive.ts
packages/agent/src/tools/derive.test.ts
packages/agent/src/tools/tier3.ts
packages/agent/src/tools/tier3.test.ts
packages/agent/src/tools/registry.ts
packages/agent/src/policy.ts
packages/agent/src/loop.ts
packages/agent/src/loop.test.ts
packages/ui/src/jobs/job-panel.tsx
packages/ui/src/jobs/job-panel.test.ts
packages/ui/src/jobs/job-panel.browser.test.tsx
packages/ui/src/i18n/en.ts
packages/ui/src/index.ts
packages/ui/src/shell.tsx
apps/web/src/flags.ts
apps/web/src/app.tsx
docs/questions.md
.changeset/t-0306-jobs-tier3.md
```

## Acceptance criteria

1. `AssetService.generate(providerId, request, options, signal)` enqueues kind `generate`: `submit` → poll with backoff 2 s → 10 s cap → `fetchResult` → import pipeline (`08` §7, optional decimation to `targetTriangles`, rescale to `targetSizeMeters`) → `commitPlan` with `provenance.generator` filled and prompt hash recorded (`07` §8.1). Results never skip the import pipeline (`INV-PRV-05`). License ≠ `unknown`.
2. `shouldOmitTool` no longer drops tier 3. Tools listed in `06` §5 / `08` §10 exist, are thin wrappers around `AssetService` / `JobQueue`, and return `{ jobId, etaSeconds }`. Tier 4 (`script.run`, `procedural.define`, `behavior.attach`) stays omitted.
3. `jobs.await({ jobId, timeoutMs })` rejects `timeoutMs > 120000` (clamp or `INVALID_INPUT`, Q-0179) and waits until the job finishes, fails, or times out. Jobs outliving the run continue and commit with `author.runId` retained.
4. When a watched job finishes, the runtime injects a `job.updated` note into the next step (`06` §5).
5. Job panel in `@tessera/ui` lists `JobQueue.list()`, shows `progress` / `message` / `state`, and Cancel calls `JobQueue.cancel`. Unit/browser-mode tests; do not require a played-through editor session.
6. `defaultRunPolicy.enabledTiers` includes `3` (Q-0178). Flag `jobsPanel` (or equivalent) turned on by this ticket.
7. Changeset. README/TSDoc. Coverage holds.

## Tests

| Test | File |
| --- | --- |
| `'INV-PRV-05 generate → import pipeline → commit fills generator and license'` | `packages/assets/src/generate.test.ts` |
| `'tier-3 tools exist and return jobId + etaSeconds'` | `packages/agent/src/tools/tier3.test.ts` |
| `'jobs.await honors 120000 ms cap'` | `packages/agent/src/tools/tier3.test.ts` |
| `'finished job injects job.updated into the next step'` | `packages/agent/src/loop.test.ts` |
| `'enqueue import/generate JobSpec emits job.updated progress'` | `packages/assets/src/generate.test.ts` |
| `'cancel in-flight job'` | `packages/assets/src/generate.test.ts` |
| `'job panel renders progress and cancel invokes JobQueue.cancel'` | `packages/ui/src/jobs/job-panel.browser.test.tsx` |
| `'tier 4 tools remain omitted'` | `packages/agent/src/tools/derive.test.ts` |

## Non-goals

Playwright furnish-room e2e. Kenney. Live provider calls. Changing JobQueue max-running-per-kind.

## Notes for the implementing agent

Tier-3 tools are **not** catalog commands (`asset.search` is absent from `packages/schema` command catalog). Register them via `ToolRegistry.register`, same pattern as meta-tools (Q-0180). `ui` must not import `providers-generation`.

---

# T-0307 — KTX2/Draco import/export options

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/assets`, `@tessera/exporters` |
| Size | L |
| Depends on | T-0109 (`done`) |
| Status | `done` |

## Goal

Optional KTX2 (UASTC for normal maps, ETC1S otherwise, textures > 1024²) and Draco actually encode on import when those options are set and on glTF export when `textures = 'ktx2'` / `compression = 'draco'` (`08` §7.1, `09` §3.1). With no optimization, import→export still preserves geometry/materials/textures (`INV-AST-05`). `meshopt` remains `UNSUPPORTED` (non-goal).

## Context

- Spec: `docs/08-assets-and-storage.md` §7.1 step 4, INV-AST-05; `docs/09-export-and-bridges.md` §3.1
- Current exporters return `UNSUPPORTED` for `textures: 'ktx2'` and `compression: 'draco'`
- gltf-transform already used for import/export; encoders are injected so tests do not need network or GPU (Q-0181)

## Touches

```
packages/assets/src/import-worker.ts
packages/assets/src/import-worker.test.ts
packages/assets/src/import-plan.ts
packages/assets/src/encode-options.ts
packages/assets/src/encode-options.test.ts
packages/exporters/src/gltf.ts
packages/exporters/src/gltf.test.ts
packages/exporters/src/options.ts
packages/exporters/README.md
packages/assets/README.md
docs/questions.md
.changeset/t-0307-ktx2-draco.md
```

## Acceptance criteria

1. `importGltf` accepts optional `compress?: boolean` and `textureCompress?: boolean` (names may match spec `options.compress` / `textureCompress`, Q-0181). When set: `textureCompress` to KTX2 (UASTC for normal maps, ETC1S otherwise) for textures > 1024²; `draco()` when `compress`; `simplify()` to `targetTriangles` when provided (`08` §7.1).
2. glTF export: `textures: 'ktx2'` produces KTX2 (KHR_texture_basisu / `image/ktx2`); `compression: 'draco'` produces Draco-compressed meshes. Tests assert a successful export actually encodes those formats — not `UNSUPPORTED`.
3. `compression: 'meshopt'` stays `UNSUPPORTED` (phase-3 non-goal).
4. With optimization off, `INV-AST-05` still holds (vertex/index counts within dedupe; materials and textures byte-identical).
5. Inspector field copy no longer says ktx2/draco are unavailable. Changeset. README.

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-05 import→export without optimization preserves geometry/materials/textures'` | `packages/assets/src/import-worker.test.ts` |
| `'import textureCompress writes KTX2 for textures > 1024²'` | `packages/assets/src/encode-options.test.ts` |
| `'import compress encodes Draco'` | `packages/assets/src/encode-options.test.ts` |
| `'export textures ktx2 encodes KTX2'` | `packages/exporters/src/gltf.test.ts` |
| `'export compression draco encodes Draco'` | `packages/exporters/src/gltf.test.ts` |
| `'meshopt remains UNSUPPORTED'` | `packages/exporters/src/gltf.test.ts` |

## Non-goals

meshopt encode. INV-AST-06 50 MB e2e. Khronos validator GPU. Changing sidecar format.

## Notes for the implementing agent

Inject encoder functions so Node tests can use a deterministic stub that still writes a valid KTX2/Draco glTF document (extension present, mime/buffer views changed). Do not return `UNSUPPORTED` for the two options this ticket enables.

---

# T-0308 — Attribution/license export

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/exporters` |
| Size | S |
| Depends on | T-0302 |
| Status | `done` |

## Goal

Exports include `ATTRIBUTIONS.md` whenever any exported asset requires attribution, including generated/provider-terms assets (`INV-AST-03`, `08` §8, `09` §9). Omitted when none require it. Goldens cover `CC-BY-*` and generated assets.

## Context

- Spec: `docs/08-assets-and-storage.md` §8; `docs/09-export-and-bridges.md` §9; INV-AST-03
- T-0110 already emits `ATTRIBUTIONS.md` for `CC-BY-*` and assets with `provenance.generator`
- This ticket adds goldens for generated/provider-terms and any gap vs `09` §9 (author, source URL, license, provider-terms notes)

## Touches

```
packages/exporters/src/attribution.ts
packages/exporters/src/attribution.test.ts
packages/exporters/src/gltf.test.ts
packages/exporters/fixtures/attribution/
packages/exporters/README.md
docs/questions.md
.changeset/t-0308-attribution.md
```

## Acceptance criteria

1. `INV-AST-03`: bundle includes `ATTRIBUTIONS.md` iff at least one exported asset requires attribution (`CC-BY-*` or provider terms / generated).
2. Markdown shape from `09` §9: one section per license; per asset: name, author, source URL, license; plus provider-terms notes for generated assets (`provenance.generator`).
3. Goldens: (a) `CC-BY-4.0` library asset (b) generated asset with provider terms (c) mixed (d) none required → file omitted.
4. `license = 'proprietary' | 'unknown'` still flagged in export warnings; export is not blocked (`08` §8).
5. Changeset.

## Tests

| Test | File |
| --- | --- |
| `'INV-AST-03 CC-BY golden includes ATTRIBUTIONS.md'` | `packages/exporters/src/attribution.test.ts` |
| `'INV-AST-03 generated/provider-terms golden includes provider notes'` | `packages/exporters/src/attribution.test.ts` |
| `'ATTRIBUTIONS.md omitted when none require attribution'` | `packages/exporters/src/attribution.test.ts` |

## Non-goals

Kenney. Changing glTF mapping. Blocking export of `unknown` licenses.

## Notes for the implementing agent

Prefer extending `buildAttributionMarkdown` over a rewrite. Do not invent a new license enum; `License` stays a string (`03`).

---

# T-0309 — Kenney source (Draft — Q-0003)

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `@tessera/assets` |
| Size | M |
| Depends on | Q-0003 answered |
| Status | `blocked` |

## Goal

Do **not** implement. Kenney is listed in `17` phase 3 and `08` §6 as a curated in-repo manifest, but Q-0003 is unanswered (hosting converted glb files).

## Context

- Spec: `docs/08-assets-and-storage.md` §6 Kenney row (Draft)
- Question: `docs/questions.md` Q-0003

## Touches

```
(none until Q-0003 is answered)
```

## Acceptance criteria

1. Ticket remains `blocked` until Q-0003 has an Answer.
2. No `packages/assets/data/kenney-index.json` in this phase.

## Tests

| Test | File |
| --- | --- |
| `'T-0309 stays blocked on Q-0003'` | `scripts/check-phase-3-tickets.test.ts` |

## Non-goals

Inventing hosting. In-browser zip conversion. Phase 8 community mirrors.

## Notes for the implementing agent

If you are tempted to “just add Kenney CC0 links”, stop. Record nothing new beyond keeping this ticket blocked.

---

# T-0310 — Phase 3 exit: score `core.generate-barrel`

| Field | Value |
| --- | --- |
| Phase | 3 |
| Package | `evals` / `docs` |
| Size | M |
| Depends on | T-0306 |
| Status | `done` |

## Goal

`core.generate-barrel` is scored in replay (no longer skipped as `needs-generation`) and its hard assertions match `13` §5.4: generated asset with provenance; entity near the wall; on ground. A phase-3 runbook documents replay plus optional live smoke (`TESSERA_LIVE=1`). Do not git-tag `m3-assets`.

## Context

- Spec: `docs/13-testing-and-evals.md` §3, §5.4 `core.generate-barrel`; `docs/17-roadmap.md` phase 3
- Q-0131 deferred scoring until generation providers exist
- Fake provider in replay (`13` §5.4). Live smoke is maintainer-only (`AGENTS.md` forbids network in tests)

## Touches

```
evals/suites/core/core-20.eval.ts
evals/suites/core/catalog.test.ts
evals/src/runner.ts
evals/src/oracle-llm.ts
evals/README.md
evals/fixtures/recordings/**
docs/runbooks/phase-3-assets-check.md
scripts/check-phase-3-exit.test.ts
docs/questions.md
docs/17-roadmap.md
.changeset/t-0310-phase-3-exit.md
```

## Acceptance criteria

1. `core.generate-barrel` is in the scored replay set. Assertions: generated asset with provenance (`source` generated / `provenance.generator`); entity near the wall; on ground (`13` §5.4). Not only `*barrel*` name.
2. Replay uses `FakeGenerationProvider` (and `FakeAssetSource` if needed). No network (`INV-TST-01`).
3. `pnpm eval:replay` on representative core-20 replay succeeds with the same scored outcome for `core.generate-barrel` (pass, not skipped) on two consecutive runs.
4. Runbook `docs/runbooks/phase-3-assets-check.md` names replay commands, that `core.generate-barrel` is scored, and how a maintainer runs live smoke (`TESSERA_LIVE=1`) for “furnish a room from CC0 props + generate one custom prop”.
5. Recordings remain secret-scanned (`INV-TST-04`). New LLM tool-call fixtures committed if required.
6. T-0300–T-0308 and T-0310 marked `done` with PR links when landed; T-0309 stays `blocked`. No `m3-assets` git tag from the agent.
7. Roadmap phase 3 row is not marked complete until this ticket’s replay evidence exists.

## Tests

| Test | File |
| --- | --- |
| `'core.generate-barrel is scored and assertions match 13 §5.4'` | `evals/suites/core/catalog.test.ts` |
| `'runbook names replay, generate-barrel scored, TESSERA_LIVE=1'` | `scripts/check-phase-3-exit.test.ts` |
| `'INV-TST-04 recordings contain no secrets'` | `evals/suites/core/recordings.test.ts` |

## Non-goals

Git-tagging `m3-assets`. Live Meshy/Tripo/Rodin/HF in CI. Kenney. Claiming the human furnish-room trial is done without attached evidence.

## Notes for the implementing agent

Update oracle/replay fixtures so the agent calls `asset.generateMesh` (or equivalent) rather than only `asset.create` with a box named barrel. Keep `needs-generation` tag optional; scoring must include the case (Q-0182).
