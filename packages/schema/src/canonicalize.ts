function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const nested = value[key];
    sorted[key] = sortValue(nested);
  }
  return sorted;
}

/**
 * Canonical snapshot JSON: sorted keys, 2-space indent, LF, trailing newline.
 *
 * @remarks INV-DOC-08
 *
 * @public
 */
export function canonicalize(value: unknown): string {
  const json = `${JSON.stringify(sortValue(value), null, 2)}\n`;
  return json.replace(/\r\n/g, "\n");
}
