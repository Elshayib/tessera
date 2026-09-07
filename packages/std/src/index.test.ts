import { expect, test } from "vitest";
import { PACKAGE_NAME } from "./index.js";

test("exports PACKAGE_NAME", () => {
  expect(PACKAGE_NAME).toBe("@tessera/std");
});
