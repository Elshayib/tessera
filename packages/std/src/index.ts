/**
 * Shared primitives for Tessera: Result, errors, invariant, ids, Logger, Emitter, Clock, abort, redact.
 *
 * @public
 */
export const PACKAGE_NAME = "@tessera/std" as const;

export { abortError, combineSignals, throwIfAborted } from "./abort.js";
export type { Clock } from "./clock.js";
export { systemClock } from "./clock.js";
export type { EmitterOptions } from "./emitter.js";
export { Emitter } from "./emitter.js";
export type { ErrorCode, TesseraError } from "./error.js";
export { tesseraError } from "./error.js";
export type { IdPrefix } from "./id.js";
export { isId, newId } from "./id.js";
export { InvariantError, invariant } from "./invariant.js";
export type { LogEntry, Logger, LogLevel, LogSink, MemorySink } from "./logger.js";
export { createLogger, createMemorySink } from "./logger.js";
export { redact } from "./redact.js";
export type { Err, Ok, Result } from "./result.js";
export { andThen, err, isErr, isOk, map, ok } from "./result.js";
