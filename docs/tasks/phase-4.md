# Phase 4 — Engine bridges

Milestone: `m4-engine-bridges` · T-0400 freezes tickets first.
Default first target: **Godot** (Q-0005 still open; do not start Unity/Unreal first unless answered).

| Id | Title | Package | Depends | Status |
| --- | --- | --- | --- | --- |
| T-0400 | Freeze phase-4 tickets + sidecar v1 freeze | docs, 09 | T-0310 | `todo` |
| T-0401 | Sidecar schema + golden vectors | exporters, schema | T-0400 | `todo` |
| T-0402 | Engine conversion tables (Y-up m → each engine) | exporters | T-0401 | `todo` |
| T-0403 | Godot 4 addon: import glb + sidecar | bridges/godot-addon | T-0402 | `todo` |
| T-0404 | Godot addon tests in CI | bridges/godot-addon | T-0403 | `todo` |
| T-0405 | Unity 6 package (glTFast + ScriptedImporter) | bridges/unity-package | T-0402 | `todo` |
| T-0406 | Unreal Python remote-execution importer | bridges/unreal | T-0402 | `todo` |
| T-0407 | Blender add-on (GPL-3.0, isolated package) | bridges/blender-addon | T-0402 | `todo` |
| T-0408 | Docs per bridge | apps/docs | T-0404 | `todo` |
| T-0409 | Phase 4 exit: same scene in Godot + Unity | docs | T-0404, T-0405 | `todo` |

## Specs

`09-export-and-bridges.md` (bridges still Draft until T-0400), ADR-0009, ADR-0011, Q-0005.

## License

`bridges/blender-addon` is GPL-3.0-or-later. Do not import it from MIT packages.
