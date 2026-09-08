import { expect, test } from "vitest";
import campfire from "../fixtures/documents/0.1.0/campfire.json" with { type: "json" };
import empty from "../fixtures/documents/0.1.0/empty.json" with { type: "json" };
import { validateDocument } from "./validate.js";

test("empty + campfire fixtures validate", () => {
  expect(validateDocument(empty).ok).toBe(true);
  expect(validateDocument(campfire).ok).toBe(true);
});
