import { expect, test } from "vitest";
import { BUILTIN_GENERATION_PROVIDER_IDS, PACKAGE_NAME } from "./index.js";

test("exports PACKAGE_NAME", () => {
  expect(PACKAGE_NAME).toBe("@tessera/generation");
  expect(BUILTIN_GENERATION_PROVIDER_IDS).toHaveLength(5);
});
