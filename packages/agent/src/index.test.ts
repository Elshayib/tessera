import { expect, test } from "vitest";
import { PACKAGE_NAME, PROBE_CACHE_TTL_MS } from "./index.js";

test("exports PACKAGE_NAME", () => {
  expect(PACKAGE_NAME).toBe("@tessera/agent");
  expect(PROBE_CACHE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
});
