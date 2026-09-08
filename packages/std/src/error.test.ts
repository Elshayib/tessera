import { expect, test } from "vitest";
import type { ErrorCode } from "./error.js";
import { tesseraError } from "./error.js";

const errorCodes = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "CONFLICT",
  "INVARIANT_VIOLATION",
  "PERMISSION_DENIED",
  "UNSUPPORTED",
  "CANCELLED",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "IO_ERROR",
  "BUDGET_EXCEEDED",
  "RATE_LIMITED",
] as const satisfies ReadonlyArray<ErrorCode>;

test("Every ErrorCode is constructible", () => {
  for (const code of errorCodes) {
    const error = tesseraError(code, "message", { id: "e_test" });
    expect(error.code).toBe(code);
    expect(error.message).toBe("message");
    expect(error.details).toEqual({ id: "e_test" });
  }
  expect(errorCodes).toHaveLength(12);
});
