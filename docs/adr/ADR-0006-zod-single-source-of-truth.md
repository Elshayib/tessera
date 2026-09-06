# ADR-0006 — Zod 4 schemas as the single source of truth

Status: Accepted · Date: 2026-09-06

## Context
The document schema, command inputs, query outputs, agent tool definitions, MCP tool JSON Schemas, inspector UI and documentation all describe the same shapes. Multiple definitions drift and are a classic source of agent tool errors.

## Decision
All shapes are defined once as Zod 4 schemas in `@tessera/schema` with `.meta()` UI metadata. From them we derive: TypeScript types (`z.infer`), runtime validation (command bus, workers, MCP), JSON Schema (`z.toJSONSchema`) for tools and docs, the inspector UI, and default values. Migrations are functions over `unknown` validated by the target version's schema.

## Alternatives
- TypeScript types + JSON Schema hand-written: drift.
- TypeBox / Valibot / ArkType: capable; Zod 4 has the widest integration (AI SDK, MCP SDK examples, form libraries) and first-class JSON Schema output; performance is adequate for document sizes in scope.
- Protobuf/FlatBuffers: unnecessary — the document is JSON-shaped and human-readable by design.

## Consequences
- `zod` is a dependency of `schema`, `core`, `agent`, `mcp`, `plugin-api` only.
- Tests enumerate registries to ensure every command/query/component has metadata (`INV-CMD-10`, `INV-DOC-09`).
- Schema changes are ADR-worthy when they alter the document format.
