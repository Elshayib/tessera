/**
 * Wraps untrusted strings as data (`06` §12).
 *
 * @example
 * ```ts
 * wrapUntrusted("polyhaven:search", "Oak tree");
 * ```
 *
 * @public
 */
export function wrapUntrusted(source: string, value: string): string {
  return `<untrusted source="${escapeAttr(source)}">${escapeBody(value)}</untrusted>`;
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function escapeBody(value: string): string {
  return value.replaceAll("<", "&lt;");
}
