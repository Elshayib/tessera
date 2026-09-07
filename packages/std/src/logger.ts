import { invariant } from "./invariant.js";
import { redact } from "./redact.js";

/**
 * Logger levels. Event names are `pkg.subsystem.event` in snake_case.
 *
 * @public
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log sink. Implementations must not throw.
 *
 * @public
 */
export type LogSink = (level: LogLevel, event: string, fields?: Record<string, unknown>) => void;

/**
 * Injected logger. Fields are redacted before they reach sinks.
 *
 * @public
 */
export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void;
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}

/**
 * One record stored by {@link createMemorySink}.
 *
 * @public
 */
export interface LogEntry {
  readonly level: LogLevel;
  readonly event: string;
  readonly fields?: Record<string, unknown>;
}

/**
 * Ring-buffer sink used in tests and diagnostics.
 *
 * @public
 */
export interface MemorySink {
  readonly entries: ReadonlyArray<LogEntry>;
  readonly write: LogSink;
}

const DEFAULT_MEMORY_CAPACITY = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactFields(
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (fields === undefined) {
    return undefined;
  }
  const redacted = redact(fields);
  invariant(isRecord(redacted), "redact preserves records");
  return redacted;
}

/**
 * Creates a logger that fans out to `sinks`. Fields are passed through {@link redact}.
 *
 * @example
 * ```ts
 * const sink = createMemorySink();
 * const logger = createLogger([sink.write]);
 * logger.info("std.example.started", { id: "e_abc" });
 * ```
 *
 * @public
 */
export function createLogger(sinks: readonly LogSink[]): Logger {
  const write = (level: LogLevel, event: string, fields?: Record<string, unknown>): void => {
    const redacted = redactFields(fields);
    for (const sink of sinks) {
      if (redacted === undefined) {
        sink(level, event);
      } else {
        sink(level, event, redacted);
      }
    }
  };

  return {
    debug: (event, fields) => {
      write("debug", event, fields);
    },
    info: (event, fields) => {
      write("info", event, fields);
    },
    warn: (event, fields) => {
      write("warn", event, fields);
    },
    error: (event, fields) => {
      write("error", event, fields);
    },
  };
}

/**
 * Creates a ring-buffer {@link LogSink} with `capacity` entries (default 10_000).
 *
 * @example
 * ```ts
 * const sink = createMemorySink(16);
 * sink.write("info", "std.example", { id: "e_abc" });
 * ```
 *
 * @public
 */
export function createMemorySink(capacity = DEFAULT_MEMORY_CAPACITY): MemorySink {
  const entries: LogEntry[] = [];
  return {
    get entries() {
      return entries;
    },
    write(level, event, fields) {
      const entry: LogEntry = fields === undefined ? { level, event } : { level, event, fields };
      entries.push(entry);
      if (entries.length > capacity) {
        entries.shift();
      }
    },
  };
}
