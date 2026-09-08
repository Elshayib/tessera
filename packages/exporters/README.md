# `@tessera/exporters`

glTF 2.0 + Tessera sidecar from the **document** (never from the three.js scene). Engine conversion tables for bridges (`09`).

## Public API

| Export | Description |
| --- | --- |
| `createGltfExporter` | `Exporter` id `gltf`: GLB/glTF + `<name>.tessera.json` (`09` §2–§4). |
| `GltfExportOptionsSchema` | Zod options with inspector metadata, including `deterministic` (Q-0028). |
| `buildAttributionMarkdown` | `ATTRIBUTIONS.md` for CC-BY and generated assets (`09` §9). |
| `candelaToGodotOmniLumens` / `candelaToGodotSpotLumens` | Godot 4 physical light conversions (`09` §5). |
| `luxToUnityUrpSun` / `candelaToUnityUrpPoint` | Unity URP intensity mapping. |
| `luxToBlenderSunWattsPerSquareMeter` / `candelaToBlenderPointWatts` | Blender watt conversions (683 lm/W). |
| `UNREAL_*_INTENSITY_UNITS` | Unreal 5.7 intensity unit names. |

## Dependency rules

Layer 2. May import `@tessera/std`, `@tessera/schema`, `@tessera/storage`, `@tessera/assets` (primitive generator, Q-0057), `@gltf-transform/*`, `zod`. Must not import `@tessera/engine` (`INV-EXP-01`). Must not import `three`.

## Testing notes

Colocated Vitest. Coverage ≥ 85%. Khronos `gltf-validator` in Node tests (`INV-EXP-03`).

## Related specs

- `docs/09-export-and-bridges.md`
- ADR-0009
- Tickets T-0110, T-0111
