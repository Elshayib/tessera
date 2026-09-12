import { expect, test } from "vitest";
import { mapGenerationError } from "./map-provider-error.js";

test("INV-PRV-03 HTTP 401/403 → PERMISSION_DENIED", () => {
  expect(mapGenerationError({ kind: "http", status: 401 }).code).toBe("PERMISSION_DENIED");
  expect(mapGenerationError({ kind: "http", status: 403 }).code).toBe("PERMISSION_DENIED");
});

test("INV-PRV-03 HTTP 404 → NOT_FOUND; 429 RATE_LIMITED; abort CANCELLED", () => {
  expect(mapGenerationError({ kind: "http", status: 404 }).code).toBe("NOT_FOUND");
  expect(mapGenerationError({ kind: "http", status: 429, retryAfterMs: 100 }).details).toEqual({
    retryAfterMs: 100,
  });
  expect(mapGenerationError({ kind: "abort" }).code).toBe("CANCELLED");
  expect(mapGenerationError({ kind: "timeout" }).code).toBe("TIMEOUT");
  expect(mapGenerationError({ kind: "network" }).code).toBe("PROVIDER_ERROR");
  expect(
    mapGenerationError({ kind: "http", status: 500, vendorBody: "secret" }).message.includes(
      "secret",
    ),
  ).toBe(false);
});
