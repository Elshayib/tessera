import { expect, test } from "vitest";
import { mapProviderError } from "./index.js";

test("INV-PRV-03 HTTP 401/403 → PERMISSION_DENIED", () => {
  expect(mapProviderError({ kind: "http", status: 401 }).code).toBe("PERMISSION_DENIED");
  expect(mapProviderError({ kind: "http", status: 403 }).code).toBe("PERMISSION_DENIED");
});

test("INV-PRV-03 HTTP 404 model → NOT_FOUND", () => {
  expect(mapProviderError({ kind: "http", status: 404 }).code).toBe("NOT_FOUND");
});

test("INV-PRV-03 HTTP 429 → RATE_LIMITED with retryAfterMs", () => {
  const withRetry = mapProviderError({ kind: "http", status: 429, retryAfterMs: 1500 });
  expect(withRetry.code).toBe("RATE_LIMITED");
  expect(withRetry.details).toEqual({ retryAfterMs: 1500 });
  const withoutRetry = mapProviderError({ kind: "http", status: 429 });
  expect(withoutRetry.code).toBe("RATE_LIMITED");
  expect(withoutRetry.details).toBeUndefined();
});

test("INV-PRV-03 timeout → TIMEOUT; abort → CANCELLED; 5xx/network → PROVIDER_ERROR", () => {
  expect(mapProviderError({ kind: "timeout" }).code).toBe("TIMEOUT");
  expect(mapProviderError({ kind: "http", status: 408 }).code).toBe("TIMEOUT");
  expect(mapProviderError({ kind: "abort" }).code).toBe("CANCELLED");
  expect(mapProviderError({ kind: "http", status: 503 }).code).toBe("PROVIDER_ERROR");
  expect(mapProviderError({ kind: "http" }).code).toBe("PROVIDER_ERROR");
  expect(mapProviderError({ kind: "network" }).code).toBe("PROVIDER_ERROR");
});

test("INV-PRV-03 content_filter → PROVIDER_ERROR reason content_filter", () => {
  const error = mapProviderError({ kind: "content_filter" });
  expect(error.code).toBe("PROVIDER_ERROR");
  expect(error.details).toEqual({ reason: "content_filter" });
});

test("INV-PRV-03 raw vendor body is not on TesseraError", () => {
  const secret = "sk-live-vendor-body";
  const error = mapProviderError({
    kind: "http",
    status: 500,
    vendorBody: secret,
  });
  expect(error.message.includes(secret)).toBe(false);
  expect(JSON.stringify(error).includes(secret)).toBe(false);
});
