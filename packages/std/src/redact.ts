const SECRET_KEY = /key|token|secret|authorization|password|cookie/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactUnknown(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    return value.map((item) => redactUnknown(item, seen));
  }
  if (isRecord(value)) {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = SECRET_KEY.test(key) ? "[redacted]" : redactUnknown(nested, seen);
    }
    return result;
  }
  return value;
}

/**
 * Replaces secret-looking keys at any depth with `'[redacted]'`.
 *
 * Keys match `/key|token|secret|authorization|password|cookie/i`.
 *
 * @example
 * ```ts
 * redact({ apiKey: "abc", nested: { password: "p" } });
 * ```
 *
 * @public
 */
export function redact(value: unknown): unknown {
  return redactUnknown(value, new WeakSet<object>());
}
