# Task tickets

Tickets are the **only** unit of implementation. Specs are the truth; a ticket is a slice of a spec that one PR can finish.

## How to use this folder

1. Read `docs/18-implementation-playbook.md`.
2. Open the lowest phase that still has `todo` tickets.
3. Take the lowest-id ticket whose `Depends on` list is all `done`.
4. Follow `AGENTS.md §2`.

Status values: `todo` → `in-progress` → `done` (add the PR link) · `blocked` · `split`.

## Index

| File | Phase | Milestone | First ticket |
| --- | --- | --- | --- |
| [phase-0.md](phase-0.md) | 0 Foundations | `m0-foundations` | **T-0001** (start here) |
| [phase-1.md](phase-1.md) | 1 Composition editor | `m1-composition-editor` | T-0100 |
| [phase-2.md](phase-2.md) | 2 Agent v1 | `m2-agent-v1` | T-0200 |
| [phase-3.md](phase-3.md) | 3 Assets | `m3-assets` | T-0300 |
| [phase-4.md](phase-4.md) | 4 Engine bridges | `m4-engine-bridges` | T-0400 |
| [phase-5.md](phase-5.md) | 5 MCP + desktop | `m5-mcp-desktop` | T-0500 |
| [phase-6.md](phase-6.md) | 6 Collaboration | `m6-collaboration` | T-0600 |
| [phase-7.md](phase-7.md) | 7 Depth | `m7-depth` | T-0700 |
| [phase-8.md](phase-8.md) | 8 Community | `m8-community` | T-0800 |

Later-phase files list tickets with goals, spec links and dependencies. They are filled to the same depth as phase 0 **before that phase starts** (the first ticket of a phase is “freeze tickets for this phase”). Do not implement a later-phase ticket that still says `Draft — expand before claiming`.

## Splitting

If a ticket exceeds 600 changed lines excluding tests, copy `docs/templates/task-template.md`, assign the next free id in that phase, mark the original `split`, and list the children under it.
