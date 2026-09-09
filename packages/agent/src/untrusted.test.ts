import { expect, test } from "vitest";
import { wrapUntrusted } from "./untrusted.js";

test("untrusted wrapper", () => {
  expect(wrapUntrusted("polyhaven:search", "Oak <tree>")).toBe(
    '<untrusted source="polyhaven:search">Oak &lt;tree></untrusted>',
  );
});
