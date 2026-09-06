# 16 — Release and versioning

Status: Accepted · Last updated: 2026-09-06 · Phase: 0+

## 1. Versioning

- Packages (`@tessera/*`) use independent semver via Changesets. Pre-1.0: breaking changes bump **minor**, everything else patch. Post-1.0: standard semver.
- The app (`apps/web`, `apps/desktop`) has its own version shown in Settings → About and in `meta.generator` of documents it saves.
- Document format version (`document.version`) is independent and changes only with schema changes (`03 §11`).
- Public contracts with their own version fields: sidecar (`09 §4`), MCP tool surface (`11 §2`), local generation worker API (`07 §8.3`), plugin API (`12 §5`).

## 2. Branching and channels

| Channel | Trigger | Deploys |
| --- | --- | --- |
| `preview` | every merge to `main` | web app to the preview URL (GitHub Pages `preview/` or Cloudflare Pages preview) |
| `stable` | tag `v<app version>` | web app to the stable URL, npm publish of changed packages with provenance, GitHub Release with generated notes, desktop builds (phase 5) |

`main` is always releasable; feature flags hide unfinished work (`01 §15`).

## 3. Release cadence

- Regular release every two weeks when `main` has user-visible changes; hotfix releases any time for regressions or security fixes.
- Phase exits (`17-roadmap.md`) are tagged milestones (`m1`, `m2`, …) in addition to version tags.

## 4. Release procedure (maintainer, automated where possible)

1. `pnpm changeset version` on a release branch → bumps and changelogs; PR reviewed and merged.
2. CI on the merged commit: full gates + benchmarks at 2× thresholds + `evals-replay`.
3. Manual checklist (§5) executed and recorded in the release PR.
4. Tag `vX.Y.Z` → release workflow publishes packages (npm provenance), deploys the web app, builds and signs desktop binaries (phase 5), creates the GitHub Release with changeset notes.
5. Post-release: smoke test the stable URL on the support matrix; open the next milestone.

## 5. Manual release checklist

- Reference scenes R1/R2/R3 open, render, export; frame budgets met on baseline hardware (`01 §8`).
- WebGL2 fallback verified in a browser with WebGPU disabled.
- Import/export round-trip on the fixture set; glTF validator clean.
- Agent live smoke: 5 `core-20` cases on two providers.
- Accessibility pass: keyboard-only walk-through of create → edit → export; screen reader labels spot check.
- Bundle sizes within budget; no new dependencies with disallowed licenses.
- Desktop (phase 5): install/update on Windows, macOS, Linux; MCP handshake with one client.

## 6. Rollback

Web: redeploy the previous tag (one workflow dispatch). npm: publish a patch reverting the change (never unpublish). Desktop: the updater points at the previous release by editing the update manifest.

## 7. Deprecation policy

Public APIs (`@public`) deprecated with `@deprecated` and a changelog entry; removed after one minor pre-1.0 and one major post-1.0. Document format migrations are kept indefinitely.
