# `@tessera/std`

Shared primitives for Tessera. Later packages import only this package for Result, errors, invariant, ids, logging, events, time, abort, and redaction.

## Public API

| Export | Kind | Description |
| --- | --- | --- |
| `PACKAGE_NAME` | `const` | Package name string `"@tessera/std"`. |
| `Result`, `Ok`, `Err` | types | Handleable success or failure. |
| `ok`, `err`, `isOk`, `isErr`, `map`, `andThen` | functions | Result constructors and combinators. |
| `ErrorCode`, `TesseraError` | types | Stable error codes and error shape. |
| `tesseraError` | function | Builds a `TesseraError`. |
| `InvariantError`, `invariant` | class / function | Programmer-error throw helper. |
| `IdPrefix`, `newId`, `isId` | type / functions | Opaque prefixed ids (`e_…`, `a_…`, …). |
| `Logger`, `LogSink`, `LogLevel`, `LogEntry`, `MemorySink` | types | Injected logging. |
| `createLogger`, `createMemorySink` | functions | Logger factory and ring-buffer sink. |
| `Emitter`, `EmitterOptions` | class / type | Typed events; listener throws are isolated. |
| `Clock`, `systemClock` | type / const | Injectable clock. |
| `abortError`, `throwIfAborted`, `combineSignals` | functions | Cancellation helpers. |
| `redact` | function | Deep-redacts secret-looking keys. |

## Dependency rules

Layer 0. Depends on nothing internal. Every other Tessera package may import `@tessera/std`. Must not import Node builtins (`docs/02-architecture.md` §5).

## Usage example

```ts
import { createLogger, createMemorySink, newId, ok } from "@tessera/std";

const sink = createMemorySink();
const logger = createLogger([sink.write]);
logger.info("std.example.started", { id: newId("e") });
const result = ok(1);
void result;
```

## Testing notes

Colocated Vitest tests (`src/*.test.ts`). Coverage threshold: 95% lines and branches (`docs/01-engineering-standards.md` §7). Tests inject `createMemorySink` and must not depend on wall-clock equality.

## Related specs

- `docs/01-engineering-standards.md` §6, §16
- `docs/02-architecture.md` §4, §10
- Ticket T-0002 in `docs/tasks/phase-0.md`
