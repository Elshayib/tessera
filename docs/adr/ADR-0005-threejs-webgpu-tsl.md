# ADR-0005 — three.js WebGPURenderer + TSL; vanilla three in the engine; React for panels only

Status: Accepted · Date: 2026-09-06

## Context
Candidates: three.js (WebGPU renderer and TSL now the default path, WebGL2 fallback), Babylon.js (WebGPU mature, batteries included, Apache-2.0), PlayCanvas engine (MIT engine; editor SaaS), Bevy/wgpu via WASM. The editor mirrors a document into a scene incrementally and needs the largest ecosystem for loaders, materials, helpers and community fixes.

## Decision
- `three/webgpu` `WebGPURenderer` with automatic WebGL2 fallback; all custom shading in TSL.
- The engine package uses **vanilla three.js**, not React Three Fiber: the renderer sync is an explicit, testable reconciler driven by change sets, independent of React's lifecycle. React (in `@tessera/ui`) renders panels and hosts the canvas element only.
- R3F is supported as a **code export target**.

## Alternatives
- Babylon.js: excellent engine; smaller asset/community ecosystem for this use, heavier bundle, and TSL-equivalent node material story differs; would be a valid alternative if three's WebGPU path stalls (new ADR).
- R3F in the editor: rejected — reconciling document → React → three adds a layer and ties render behavior to React scheduling; tests become harder.
- Bevy/wgpu: rejected with ADR-0001.

## Consequences
- Engine tests run in browser mode; WebGL fallback in CI, WebGPU nightly on GPU runners.
- Post-processing and custom effects are written once in TSL.
- Bundle: engine chunk lazy-loaded to meet the initial JS budget.
