import * as Y from "yjs";

/**
 * Deep-clones JSON so Yjs stores objects and arrays as atomic leaves.
 */
function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

export function setRecord(map: Y.Map<unknown>, record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value !== undefined) {
      map.set(key, cloneJson(value));
    }
  }
}

export function recordFromMap(map: Y.Map<unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of map.entries()) {
    if (value instanceof Y.Map) {
      record[key] = recordFromMap(value);
    } else {
      record[key] = cloneJson(value);
    }
  }
  return record;
}
