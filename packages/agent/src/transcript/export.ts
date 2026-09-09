import type { Result, TesseraError } from "@tessera/std";
import { err, ok, redact, tesseraError } from "@tessera/std";
import type { RunTrace, Span } from "../trace.js";

/**
 * Redacts a stored trace and optionally keeps attachment attributes (`06` §13).
 *
 * @public
 */
export function prepareRunExport(
  trace: RunTrace | undefined,
  includeAttachments: boolean,
): Result<RunTrace, TesseraError> {
  if (trace === undefined) {
    return err(tesseraError("NOT_FOUND", "no trace for run"));
  }
  const clipped = includeAttachments ? trace : stripTraceAttachments(trace);
  return ok(redactTrace(clipped));
}

/**
 * Drops image payloads from a trace's span attributes.
 *
 * @public
 */
export function stripTraceAttachments(trace: RunTrace): RunTrace {
  return {
    ...trace,
    spans: trace.spans.map((span) => ({
      ...span,
      attributes: stripRecord(span.attributes),
    })),
  };
}

function redactTrace(trace: RunTrace): RunTrace {
  return {
    ...trace,
    spans: trace.spans.map((span) => redactSpan(span)),
  };
}

function redactSpan(span: Span): Span {
  const redacted = redact(span.attributes);
  return {
    ...span,
    attributes: asAttributeRecord(redacted),
  };
}

function asAttributeRecord(value: unknown): Readonly<Record<string, string | number | boolean>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const next: Record<string, string | number | boolean> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === "string" || typeof nested === "number" || typeof nested === "boolean") {
      next[key] = nested;
    }
  }
  return next;
}

function stripRecord(
  attributes: Readonly<Record<string, string | number | boolean>>,
): Readonly<Record<string, string | number | boolean>> {
  const next: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "attachment" || key.endsWith("Image")) {
      continue;
    }
    next[key] = value;
  }
  return next;
}
