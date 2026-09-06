# ADR-0015 — Sandboxed scripting via QuickJS in a worker

Status: Accepted · Date: 2026-09-06 · Implemented in phase 7; decided now to shape the `script` asset and `behaviors` map

## Context
Agents and users will write small scripts: procedural geometry and behaviors. Running model-written code in the page is a security and stability risk (keys, DOM, infinite loops).

## Decision
Scripts are TypeScript compiled in a worker (esbuild-wasm) and executed by QuickJS (WASM) inside a dedicated worker with a minimal, message-passing API (`12 §6`): CPU interrupt at 100 ms per invocation, 64 MB memory, no network/DOM/storage, deterministic RNG. Outputs enter the document only through host-issued commands.

## Alternatives
- `new Function`/eval in the main thread: rejected (no isolation).
- Plain Web Worker without an interpreter: workers still have `fetch`, `indexedDB`, `importScripts`; CSP can limit network but not CPU/memory, and termination loses state; rejected as the sole boundary.
- WASM-only scripting (AssemblyScript/Rust): safe but hostile to agents and users; rejected for authoring; may be added as an advanced target.

## Consequences
- Deterministic, replayable scripts; behaviors export as engine stubs, not as executable code for engines.
- Extra bundle (QuickJS ~ 1 MB) loaded lazily only when scripts are used.
