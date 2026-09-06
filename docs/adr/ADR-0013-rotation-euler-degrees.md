# ADR-0013 — Rotation stored as Euler degrees XYZ in the document

Status: Accepted · Date: 2026-09-06

## Context
Quaternions are numerically ideal but opaque to humans and language models; every mainstream editor's inspector shows Euler degrees. Agents reason about "rotate 45° around Y".

## Decision
`transform.rotation = [x, y, z]` in degrees, intrinsic XYZ order (three.js `'XYZ'`), normalized to (−180, 180]. The engine converts to radians/quaternions at sync; exporters emit quaternions (glTF). Interpolation (phase 7 animation) happens in quaternion space internally with Euler keys stored for authoring.

## Alternatives
- Quaternions in the document: rejected (illegible to users and models; error-prone tool calls).
- Radians: rejected (models and users think in degrees; off-by-π bugs).

## Consequences
- Gimbal-lock ambiguity is inherent to Euler authoring; acceptable for a composition tool (same as Blender/Unity inspectors).
- Conversions are centralized and tested against three.js.
