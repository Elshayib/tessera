import type { QueryRegistry } from "@tessera/core";
import type { Result, TesseraError } from "@tessera/std";
import { err, ok, tesseraError } from "@tessera/std";

const WIDTH = 1024;
const HEIGHT = 576;

/**
 * Viewport + iso screenshots, plus top when more than 5 entities changed (Q-0127).
 *
 * @example
 * ```ts
 * captureVerificationScreenshots(queries, ["e_0000000000"]);
 * ```
 *
 * @public
 */
export function captureVerificationScreenshots(
  queries: QueryRegistry,
  changedEntities: readonly string[],
): Result<readonly unknown[], TesseraError> {
  const cameras: readonly ("viewport" | "iso" | "top")[] =
    changedEntities.length > 5 ? ["viewport", "iso", "top"] : ["viewport", "iso"];
  const shots: unknown[] = [];
  for (const camera of cameras) {
    const result = runQuery(queries, {
      width: WIDTH,
      height: HEIGHT,
      camera,
      frame: [...changedEntities],
      includeHelpers: false,
    });
    if (!result.ok) {
      return result;
    }
    shots.push(result.value);
  }
  return ok(shots);
}

function runQuery(
  queries: QueryRegistry,
  input: Record<string, unknown>,
): Result<unknown, TesseraError> {
  const runner = Reflect.get(queries, "query");
  if (typeof runner !== "function") {
    return err(tesseraError("UNSUPPORTED", "view.screenshot is not registered"));
  }
  const result: unknown = runner.call(queries, "view.screenshot", input);
  if (typeof result !== "object" || result === null || !("ok" in result)) {
    return err(tesseraError("INVARIANT_VIOLATION", "screenshot query returned a non-Result"));
  }
  if (result.ok === true && "value" in result) {
    return ok(result.value);
  }
  if (result.ok === false && "error" in result && isTesseraError(result.error)) {
    return err(result.error);
  }
  return err(tesseraError("UNSUPPORTED", "view.screenshot failed"));
}

function isTesseraError(value: unknown): value is TesseraError {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}
