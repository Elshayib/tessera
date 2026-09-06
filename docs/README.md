# Tessera documentation index

Everything here is **normative**: code is written to match these documents. When code and docs disagree, the docs are fixed first (or the code is), in the same PR.

## Status legend

| Status | Meaning |
| --- | --- |
| Accepted | Implement exactly as written. Changes need a PR that updates the doc and, if a decision changes, an ADR. |
| Draft | Direction is fixed; details may change before the phase that implements it. Implement only the parts referenced by an accepted ticket. |
| Superseded | Kept for history; see the pointer at the top of the file. |

## Documents

| # | Document | Status | Implemented in phase |
| --- | --- | --- | --- |
| 00 | [Vision, scope and non-goals](00-vision.md) | Accepted | — |
| 01 | [Engineering standards](01-engineering-standards.md) | Accepted | 0 |
| 02 | [Architecture](02-architecture.md) | Accepted | 0 |
| 03 | [Domain model (document schema)](03-domain-model.md) | Accepted | 0–1 |
| 04 | [Command bus, transactions, undo](04-command-bus.md) | Accepted | 0–1 |
| 05 | [Rendering and viewport](05-rendering.md) | Accepted | 1 |
| 06 | [Agent runtime](06-agent-runtime.md) | Accepted | 2 |
| 07 | [Providers: LLM and generation](07-providers.md) | Accepted | 2–3 |
| 08 | [Assets and storage](08-assets-and-storage.md) | Accepted | 1–3 |
| 09 | [Export and engine bridges](09-export-and-bridges.md) | Accepted (glTF + sidecar), Draft (bridges) | 1, 4 |
| 10 | [Collaboration](10-collaboration.md) | Draft | 6 |
| 11 | [MCP server and desktop shell](11-mcp-and-desktop.md) | Draft | 5 |
| 12 | [Plugin system](12-plugin-system.md) | Draft | 8 (interfaces fixed in 0) |
| 13 | [Testing and evals](13-testing-and-evals.md) | Accepted | 0+ |
| 14 | [Security threat model](14-security-threat-model.md) | Accepted | 0+ |
| 15 | [Observability](15-observability.md) | Accepted | 0+ |
| 16 | [Release and versioning](16-release-and-versioning.md) | Accepted | 0+ |
| 17 | [Roadmap](17-roadmap.md) | Accepted | — |
| 18 | [Implementation playbook (for agents)](18-implementation-playbook.md) | Accepted | — |
| — | [Glossary](glossary.md) | Accepted | — |
| — | [Open questions](questions.md) | Living | — |
| — | [ADRs](adr/README.md) | — | — |
| — | [Task tickets](tasks/README.md) | — | — |
| — | [Config templates](templates/README.md) | — | 0 |

## How to read a spec

Each spec has the same shape:

1. **Purpose and scope** — what this subsystem is responsible for and what it is not.
2. **Concepts** — the words, defined once, matching the glossary.
3. **Interfaces** — TypeScript signatures. These are contracts: implement them as written.
4. **Behavior** — rules, algorithms, invariants (numbered `INV-xx`; tests reference these ids).
5. **Non-functional requirements** — performance budgets, limits, accessibility, security.
6. **Test plan** — what must be tested and how.
7. **Open questions** — pointers into `questions.md`.

Invariants are the most important part. If you are unsure about an implementation detail, choose the option that keeps every invariant true.
