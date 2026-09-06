# 15 — Observability

Status: Accepted · Last updated: 2026-09-06 · Package: `@tessera/std` (logger), `@tessera/agent` (traces), `@tessera/ui` (diagnostics panel) · Phase: 0+

## 1. Purpose

Tessera has no backend and sends nothing home, so observability is local and user-controlled: structured logs, in-app metrics, agent traces, and an exportable diagnostics bundle that makes bug reports actionable.

## 2. Logging

- `Logger` from `@tessera/std`: `debug | info | warn | error (event, fields?)`; child loggers add fixed fields (`logger.child({ pkg: 'engine' })`).
- Event names `pkg.subsystem.event` (snake_case), e.g. `core.command_bus.committed`, `engine.assets.load_failed`, `agent.run.completed`, `providers.llm.request` (debug).
- Standard fields: `ts`, `level`, `event`, `pkg`, plus event-specific fields (ids, counts, durations in ms, sizes in bytes). Never free text with interpolated values in `event`.
- Sinks: console (dev only, pretty), ring buffer (10,000 entries, always on), file (desktop). Level defaults: `info` in production, `debug` in dev; adjustable in Settings → Diagnostics.
- `redact()` masks configured secrets and anything matching common key patterns before a field reaches a sink.

## 3. Metrics (in-app)

| Metric | Source | Shown in |
| --- | --- | --- |
| `viewport.fps`, `viewport.frameMs`, draw calls, triangles, GPU memory estimate | engine `ViewportStats` | perf overlay (toggle) |
| `command.latencyMs` histogram per command name | command bus | diagnostics panel |
| `sync.applyMs` per change set | renderer sync | diagnostics panel |
| `job.durationMs` by kind, success/failure counts | job queue | jobs panel |
| `agent.tokens`, `agent.costUsd`, steps per run, tool call counts by name, error codes | agent ledger | chat header, diagnostics |
| `storage.bytes`, quota | storage | settings → storage |
| Long tasks > 50 ms | `PerformanceObserver` | diagnostics (count + last 20 stacks in dev) |

Metrics are kept in memory (rolling windows) and included in the diagnostics bundle.

## 4. Agent traces

```ts
export interface RunTrace {
  readonly runId: string; readonly conversationId: string; readonly startedAt: string; readonly endedAt: string;
  readonly models: Record<Role, ModelRef>; readonly profile: CapabilityProfile; readonly policy: RunPolicy;
  readonly spans: readonly Span[];
  readonly usage: UsageSummary; readonly outcome: 'completed' | 'failed' | 'cancelled';
}
export interface Span {
  readonly id: string; readonly parentId?: string;
  readonly name: 'run' | 'step' | 'model.call' | 'tool.call' | 'verify.spatial' | 'verify.vision' | 'transaction';
  readonly start: number; readonly end: number;          // ms relative to run start
  readonly attributes: Readonly<Record<string, string | number | boolean>>;   // model id, tokens, tool name, ok, result bytes, transaction id…
  readonly events?: readonly { readonly time: number; readonly name: string; readonly attributes?: Record<string, unknown> }[];
}
```
Shape is OpenTelemetry-compatible so exports can be converted to OTLP JSON with a small script (`apps/cli inspect --otlp`). Traces are stored with transcripts; the chat panel offers "Show trace" per run (timeline view) and "Export run" (JSON, redacted, attachments optional).

## 5. Diagnostics bundle

Settings → Diagnostics → **Export bundle** produces a ZIP with: `logs.ndjson` (ring buffer), `metrics.json`, `capabilities.json` (engine backend, GPU adapter info, browser), `settings.redacted.json`, `document.stats.json` (counts, sizes; no content unless the user ticks "include document"), `traces/*.json` (last 5 runs), `version.json`. Bug reports link to it; nothing is uploaded automatically.

## 6. Debug and performance UI

- Perf overlay (`Ctrl+Shift+P`): fps, frame ms, draw calls, triangles, sync time, last command latency.
- Diagnostics panel: log viewer with level filter and search, metrics tables, long-task list, flags, capabilities, bundle export.
- Dev-only: change set inspector for the last transaction; renderer cache inspector (refcounts).

## 7. Invariants

| Id | Invariant |
| --- | --- |
| INV-OBS-01 | No network egress is caused by logging, metrics or traces. |
| INV-OBS-02 | Every rejected command and every failed job logs exactly one `warn`/`error` event with the error code. |
| INV-OBS-03 | Every agent run produces a `RunTrace` with a root `run` span and one `step` span per model call. |
