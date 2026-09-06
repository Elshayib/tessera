# ADR-0014 — Meters, Y-up, right-handed; physical light units

Status: Accepted · Date: 2026-09-06

## Context
glTF (the interchange) is meters, Y-up, right-handed; three.js matches. Light intensity conventions differ wildly across tools; three.js uses physical units (lux, candela, nits) with `KHR_lights_punctual` matching for punctual lights.

## Decision
The document uses meters, Y-up, right-handed, −Z forward, and physical light units (directional lux, point/spot candela, area nits). No unit conversion inside the editor; bridges convert to engine conventions using shared tables (`09 §5`).

## Alternatives
- Configurable document units/axes: rejected (complexity everywhere; conversions belong at engine boundaries).
- Unitless light intensity: rejected (non-portable; physical units export losslessly to glTF and map to Godot/Unity HDRP/Unreal/Blender physical modes).

## Consequences
- Defaults must be tuned for a good look under exposure 1 (`Q-0002`).
- Documentation and prompts state units explicitly; agents receive typical ranges.
