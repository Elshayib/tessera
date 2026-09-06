# ADR-0009 — glTF 2.0 + extras + sidecar as interchange, built with gltf-transform

Status: Accepted · Date: 2026-09-06

## Context
Targets: Godot, Unity, Unreal, Blender, web. Each has a mature glTF importer; none can consume a proprietary scene format without a plugin. glTF lacks colliders, physics, tags, area lights, environment settings and behaviors.

## Decision
- Canonical export = `.glb` (or `.gltf`) + `<name>.tessera.json` sidecar; node `extras.tessera` duplicates per-node data for importers that preserve extras.
- Exports are built directly from the document with `@gltf-transform/core` (deterministic, Node-capable, validated by the Khronos validator), never from the three.js scene.
- Bridges read both files and build native scenes; conversions live in shared tables with test vectors.

## Alternatives
- USD/OpenUSD: powerful but heavy toolchain, weak browser story, and engines' USD importers are less uniform than glTF's; revisit post-1.0 as an additional exporter.
- Engine-native scene writers (`.tscn`, Unity YAML, `.umap`): fragile, engine-version-specific; bridges may still generate native files as a convenience, from the sidecar.
- `KHR_physics_rigid_bodies` and related glTF extensions: promising; adopt as they stabilize (they map cleanly from the sidecar).

## Consequences
- Round-trip invariants (`INV-EXP-04`) are testable headless.
- The sidecar format is a versioned public contract.
