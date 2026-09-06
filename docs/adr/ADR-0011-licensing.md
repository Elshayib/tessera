# ADR-0011 — MIT core; GPL-3.0 isolated to the Blender add-on

Status: Accepted · Date: 2026-09-06

## Context
The project wants maximal adoption, plugin authorship and use in commercial pipelines, and must interoperate with Blender (add-ons must be GPL-compatible).

## Decision
- Everything in the repository is **MIT**, except `bridges/blender-addon/`, which is **GPL-3.0-or-later** and communicates with the rest only through files (exports, job JSON) — no linking, no shared code.
- Dependencies must have licenses from the allowlist in `01 §13`; copyleft requires an ADR.
- Contributors agree to license contributions under the repository license (inbound = outbound); no CLA.

## Alternatives
- Apache-2.0: explicit patent grant is attractive; MIT chosen for simplicity and ecosystem norm (three.js, Yjs, Zod are MIT). Revisit if patent concerns arise.
- AGPL/Business Source for the core: rejected (contradicts adoption and plugin goals).

## Consequences
- Commercial forks are permitted; the moat is community, evals and quality, not license.
- The Blender add-on is developed as an isolated subproject with its own LICENSE file.
