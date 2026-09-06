# 13 — Testing and agent evals

Status: Accepted · Last updated: 2026-09-06 · Packages: `@tessera/testing`, `evals/`, every package's tests · Phase: 0+

## 1. Purpose and scope

This document makes `01 §7` concrete: how tests are organized, what `@tessera/testing` provides, how provider interactions are recorded for deterministic replay, and how the agent is measured with an evaluation suite that runs in CI and produces a public model leaderboard.

## 2. Test organization

| Kind | Location | Runner | Environment |
| --- | --- | --- | --- |
| Unit | `packages/*/src/**/*.test.ts` | Vitest (`projects` config per package) | Node |
| Browser-mode | `packages/{engine,ui}/src/**/*.browser.test.ts` | Vitest browser mode, Playwright provider | Chromium (WebGL fallback in CI; WebGPU nightly) |
| Integration | `packages/*/src/**/*.int.test.ts` | Vitest | Node; may use several packages and fakes |
| E2E | `apps/web/e2e/**/*.spec.ts` | Playwright | Chromium required; WebKit/Firefox non-blocking |
| Visual | `apps/web/e2e/visual/*.spec.ts` | Playwright `toHaveScreenshot` | per-backend baselines |
| Benchmarks | `packages/*/src/**/*.bench.ts` | Vitest bench | thresholds asserted via a wrapper `expectBench(name, { p95Ms })` |
| Evals | `evals/suites/**/*.eval.ts` | `evals/runner` | Node + fakes/replay; live opt-in |

Conventions: test names reference invariants (`'INV-CMD-04 undo/redo restores snapshot'`); one behavior per test; Arrange-Act-Assert; no shared mutable state between tests; fixtures created through builders, never by loading giant JSON files except golden outputs.

## 3. `@tessera/testing`

| Export | Purpose |
| --- | --- |
| `docBuilder()` | Fluent builder: `.entity('oak_01', { parent, transform, mesh: 'oak' }).material('bark', {...}).build()` → valid `Document` |
| `fixtures.R1()`, `R2()`, `R3()`, `D1()` | Deterministic generators (seeded) of the reference scenes from `01 §8`; geometry as primitives so no blobs are required; `R1.withBlobs(store)` variant for import/export tests |
| `FakeClock` | `now()` controllable; `advance(ms)` |
| `MemoryStores` | in-memory `BlobStore`, `ProjectStore`, `TranscriptStore` |
| `FakeLlmClient` | Scripted client: `script([{ expectPromptIncludes?, respond: { text?, toolCalls? } }, …])`; records every request; supports capability presets (`noTools`, `noVision`, `smallContext`) |
| `ReplayLlmClient`, `RecordingLlmClient` | Fixture-backed clients (§4) |
| `FakeGenerationProvider`, `FakeAssetSource` | Deterministic job/search behavior with configurable latency and failures |
| `structuralHash(scene)` | Engine scene hash for `INV-RND-01/02` |
| `expectScene(doc)` | Assertions (§5.3) |
| `runCommands(bus, [...])` | Helper to apply command sequences with a test author |
| `withTempDir()` | Node temp directory for `Fs*` store tests |

## 4. Recording provider interactions

- Set `TESSERA_RECORD=1` and run the target tests/evals with real keys (local only). `RecordingLlmClient` wraps a real client and writes `fixtures/recordings/<provider>/<suite>/<case>.<model>.json`: normalized request (system prompt hash, messages, tools), response, usage, and a redaction pass (keys, dates → `<ts>`, request ids).
- `ReplayLlmClient` matches requests by a stable hash of `(model, messages without volatile fields, tool names)`; a miss fails the test with a clear message (`no recording for request hash … — run with TESSERA_RECORD=1`).
- Recordings expire after 180 days (a lint script warns) so evals do not silently test stale model behavior.
- Recorded fixtures are committed; they contain no secrets (`redact()` verified by a test that scans fixtures for key patterns).

## 5. Agent evals

### 5.1 Case format
```ts
export interface EvalCase {
  readonly id: string;                              // 'core.table-and-chairs'
  readonly title: string;
  readonly category: 'read' | 'composition' | 'layout' | 'materials' | 'lighting' | 'cameras' | 'assets' | 'repair' | 'destructive' | 'multi-step';
  readonly difficulty: 1 | 2 | 3;
  readonly setup: (t: typeof docBuilder) => Document;       // initial document
  readonly prompt: string;
  readonly attachments?: readonly string[];         // fixture image names
  readonly assertions: (ctx: EvalContext) => readonly Assertion[];   // hard, programmatic
  readonly rubric?: string;                         // for the VLM judge (soft)
  readonly policy?: Partial<RunPolicy>;             // e.g. maxSteps
  readonly tags?: readonly string[];                // 'core-20', 'needs-vision', 'needs-generation'
}
export interface EvalContext { readonly before: Document; readonly after: Document; readonly report: RunReport; readonly trace: RunTrace; readonly screenshots: readonly Screenshot[] }
export interface Assertion { readonly name: string; readonly pass: boolean; readonly detail?: string; readonly weight?: number /* default 1 */ }
```

### 5.2 Runner
`pnpm eval [--suite core] [--model <providerId>/<modelId>] [--mode replay|live] [--judge <model>] [--report out.json]`
- **replay** (CI): `ReplayLlmClient` per case × model with recordings; fails on missing recordings for `core-20` cases.
- **live** (maintainers): real providers; writes a report and, with `--record`, new fixtures.
- **judge**: optional VLM judge scoring `rubric` from final screenshots (1–5) with a fixed judge prompt; the judge model is recorded in the report.
- Scoring per case: `hardScore = passed weight / total weight`; per model: mean hard score, judge mean, steps, tokens, estimated cost, wall time, verification stats (issues found / fixed), failure taxonomy (invalid tool input, wrong entity, spatial error, gave up).
- Output: `evals/reports/<date>-<model>.json` + markdown summary; `evals/reports/leaderboard.md` aggregates the latest live run per model with date and Tessera version (maintainer-updated, public).

### 5.3 Scene assertions (`expectScene`)
`toHaveEntity(pathOrGlob)`, `toHaveCount(query, n)`, `toBeOnGround(path, tolerance)`, `toNotOverlap(paths[])`, `toBeWithin(pathA, pathB, meters)`, `toFace(pathA, pathB, toleranceDeg)`, `toHaveMaterial(path, { baseColorNear, roughnessBetween, metallicBetween })`, `toHaveLight(query, { type, colorTemperatureBetween, intensityBetween })`, `toHaveMainCamera({ framesAll: true })`, `toBeUnchanged(paths[])`, `toHaveNoIssues(checkScene)`, `toHaveTransactionsOnlyBy(author)`.

### 5.4 Core-20 suite (must pass in replay on every relevant PR)
| Id | Category | Prompt | Key assertions |
| --- | --- | --- | --- |
| core.red-cube | composition | "Add a red cube 1 m on each side at the origin." | 1 new entity; box geometry size 1; baseColor near `#ff0000`; on ground |
| core.table-chairs | layout | "Create a table with four chairs around it." | table + 4 chairs; chairs within 1.2 m; facing table ±30°; no overlaps; all on ground |
| core.campfire | lighting | "Make a campfire: three logs around a fire pit and a warm point light above it." | 3 logs radial; point light warm (< 3500 K equivalent), above center |
| core.scatter-trees | layout | "Place 12 trees on the ground at least 3 m apart." | 12 entities; pairwise distance ≥ 3; on ground |
| core.sunset | lighting | "Light this scene like a sunset." | directional light elevation 2–15°, warm color; exposure in [0.5, 2] |
| core.wood-floor | materials | "Make the floor look like dark wood." | floor material baseColor dark brown, roughness ≥ 0.5 |
| core.frame-camera | cameras | "Add a camera framing the whole scene from a 3/4 view and make it the main camera." | camera exists, `mainCamera` set, frames all |
| core.stack-boxes | layout | "Stack three boxes of decreasing size." | vertical order; touching within 0.02 m; sizes decreasing |
| core.grid-crates | layout | "Arrange the 9 crates in a 3×3 grid with 0.5 m gaps." | grid positions; gaps 0.5 ± 0.02 |
| core.lamp-sofa | layout | "Move the lamp next to the sofa." | lamp within 0.6 m of sofa; no overlap; on ground |
| core.delete-trees | destructive | "Delete all trees." | with `confirmDestructive=false`: no deletion, `ask_user` used; with true: all `tree*` gone, nothing else |
| core.rename-chairs | multi-step | "Rename the chairs chair_1 through chair_4 clockwise from the door." | 4 renames; order matches geometry |
| core.add-colliders | components | "Add colliders to all static props." | every `static`-tagged mesh has a collider; none on lights/cameras |
| core.simple-room | composition | "Build a 6×4 m room with 3 m walls and a doorway on the long side." | 4 wall pieces (or 5 with doorway split); interior dims within 0.1 m; a gap ≥ 0.9 m wide |
| core.shiny-metal | materials | "Make the metal parts shiny." | materials on `metal`-tagged entities: metallic ≥ 0.8, roughness ≤ 0.3; others unchanged |
| core.streetlights | layout | "Duplicate the streetlight along the road every 10 m." | copies spaced 10 ± 0.1 m along the road axis |
| core.hdri | assets | "Set up a forest HDRI environment from Poly Haven." | environment asset with provenance polyhaven; `environment.sky` set (recorded source fixture) |
| core.generate-barrel | assets | "Generate a low-poly barrel and place it by the wall." | generated asset with provenance; entity near wall, on ground (fake provider in replay) |
| core.fix-scene | repair | "Fix anything floating or overlapping." | `checkScene` issues before > 0, after = 0; untouched entities unchanged |
| core.describe | read | "Describe the scene." | zero transactions; report mentions entity count and main objects |

### 5.5 Extended suites (grow over time)
`layout-hard`, `materials-pbr`, `lighting-studio`, `multi-turn` (conversation memory), `small-model` (catalog + JSON mode), `vision-verify` (cases that only pass with the critic), `collab` (locks respected).

## 6. Visual regression

Reference scenes rendered at 1280×720 with fixed camera poses; baselines per backend (`webgl2`, `webgpu`); `maxDiffPixelRatio: 0.002`; update baselines only with a PR label `visual-baseline-update` and a reviewer confirmation.

## 7. Performance tests

Benchmarks assert budgets from `01 §8` using `expectBench`. CI runs benchmarks on the standard runner with thresholds 2× the budget (to absorb runner variance) and flags trends; the pre-release checklist runs them on baseline hardware at 1×.

## 8. Flake policy

A test failing without a code change is quarantined the same day (`test.todo` with ticket link), tracked with label `flaky`, and fixed before the phase exits. Retries are not used to hide flakes (`retries: 0` in CI except Playwright's 1 retry for browser startup).

## 9. Invariants

| Id | Invariant |
| --- | --- |
| INV-TST-01 | CI runs no network calls to model or asset providers (enforced by a Vitest `fetch` guard that fails on non-loopback hosts). |
| INV-TST-02 | Every `core-20` case has recordings for at least two distinct providers. |
| INV-TST-03 | Coverage thresholds from `01 §7` are configured per package and enforced. |
| INV-TST-04 | Recorded fixtures contain no secrets. |
