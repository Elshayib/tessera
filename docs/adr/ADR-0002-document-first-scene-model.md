# ADR-0002 — Document-first scene model

Status: Accepted · Date: 2026-09-06

## Context
Agent-driven 3D tools take one of two shapes: **code-first** (the model writes three.js/React code that is the scene) or **document-first** (the model edits structured data through tools). Code-first is expressive and easy to bootstrap but hard to validate, undo partially, merge collaboratively, inspect in a UI, or export to engines without executing it.

## Decision
The scene is a **document**: entities with typed components, assets, environment and behaviors (`03-domain-model.md`). Code exists only as sandboxed scripts attached to the document (procedural geometry, behaviors) and as an export target. All agents operate through schema-validated commands.

## Alternatives
Code-first (generate R3F/three code, run it): rejected for the reasons above; kept as an export format. Hybrid "code as source, document as cache": rejected because two sources of truth diverge.

## Consequences
- Validation, undo, review diffs, CRDT collaboration and engine export are uniform and cheap.
- Expressiveness beyond the schema requires new components or scripts (plugin path), which is intentional friction.
- Agents need good tools (macros) rather than free-form code to be productive; this is where the product invests.
