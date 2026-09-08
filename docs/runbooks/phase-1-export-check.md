# Phase 1 export check (Godot 4 and Blender 5)

Manual procedure for the **m1-composition-editor** exit: a Tessera glTF + sidecar export opens in Godot 4 and Blender 5 with hierarchy and names intact (`docs/17-roadmap.md`, `docs/09-export-and-bridges.md` §5–§7). Engine bridges (`bridges/*`) are **not** in scope; this is File → Open / Import of glTF.

Do **not** git-tag `m1-composition-editor` and do **not** mark phase 1 complete until a human attaches screenshots or recordings (Q-0025, T-0122).

## Versions

Use these product lines (patch versions may vary):

| App | Version line | Notes |
| --- | --- | --- |
| Godot | **4.x** (4.3 or 4.4 is fine; 4.7.2 used in the headless log) | Built-in glTF importer. Meters, Y-up. |
| Blender | **5.x** (5.2.0 LTS used in the headless log) | glTF importer; Tessera document is Y-up meters (`09` §5). Confirm the importer does not silently rescale. |

## Export command

From the repository root, using the campfire snapshot (same fixture T-0110 / T-0121 use):

```
pnpm tessera export gltf packages/schema/fixtures/documents/0.1.0/campfire.json --out ./tmp/phase-1-export-check
```

Expected files in `--out`:

- `campfire.glb`
- `campfire.tessera.json`

T-0110 also covers a primitive-box document in `@tessera/exporters` tests (`packages/exporters/src/gltf.test.ts`). Either export is valid evidence; prefer campfire so names are distinctive.

## What to assert

Open **only** `campfire.glb` (sidecar is Tessera extras; Godot/Blender glTF importers will not consume `.tessera.json` until phase 4 bridges).

| Check | Pass if |
| --- | --- |
| Node names | Scene nodes include **Ground**, **Log**, and **Camera** (campfire entity names). Do not rename on import. |
| Hierarchy | Parent/child relationships match the document (campfire roots are siblings). |
| Unit scale | A 1 m object is ~1 m in the host (Godot default unit is meter; Blender default unit is meter). No unexpected ×100 / ×0.01. |
| Up axis | World up is Y in Tessera; if Blender shows Z-up after import, that is the host convention, not a Tessera scale bug—still confirm object **sizes** are meters. |

## Human evidence checklist

Attach to the PR that claims the phase-1 milestone (or a follow-up evidence PR). Files live **outside** git unless you opt in; see `docs/recordings/README.md`.

- [ ] Godot 4.x version string (Help → About) — 4.7.2 is in the editor window title, not a dedicated About dialog still
- [ ] Blender 5.x version string (Help → About) — 5.2 is in the window title bar, not a dedicated About dialog still
- [x] Screenshot: Godot scene tree with campfire node names — `docs/recordings/phase-1-godot-scene-tree.png`
- [x] Screenshot: Blender outliner with campfire object names — `docs/recordings/phase-1-blender-outliner.png`
- [ ] Optional: short screen recording of import in each app
- [x] Confirm no git tag `m1-composition-editor` was pushed without this evidence — tag still not created (Q-0025, Q-0091)

## Evidence status

**GUI stills are in `docs/recordings/`.** They show Ground, Log, Camera (and Fire) after opening the campfire glb in Godot 4.7.2 and Blender 5.2. Capture was automated on this machine, not a signed-off PR. Do **not** git-tag `m1-composition-editor` and do **not** mark the roadmap phase 1 row complete until a human opens PRs (Q-0025) and accepts this evidence.

**Headless import (supplementary):** `docs/recordings/phase-1-export-check-headless.txt` — names and meter-scale dimensions. This is not a Godot CI job.
