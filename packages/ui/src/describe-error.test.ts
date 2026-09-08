import type { ErrorCode } from "@tessera/std";
import { tesseraError } from "@tessera/std";
import { expect, test } from "vitest";
import { describeError } from "./describe-error.js";
import { en } from "./i18n/en.js";

const CODES: readonly ErrorCode[] = [
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
];

test("describeError uses i18n key", () => {
  const error = tesseraError("PROVIDER_ERROR", "sk-live-secret from vendor");
  const described = describeError(error);
  expect(described.key).toBe("errors.PROVIDER_ERROR");
  expect(described.text).toBe(en.errors.PROVIDER_ERROR);
  expect(described.text.includes("sk-live-secret")).toBe(false);
  expect(described.text).not.toBe(error.message);
  for (const code of CODES) {
    const mapped = describeError(tesseraError(code, "raw"));
    expect(mapped.key).toBe(`errors.${code}`);
    expect(mapped.text).toBe(en.errors[code]);
  }
});
