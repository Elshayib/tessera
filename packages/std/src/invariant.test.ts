import { expect, test } from "vitest";
import { InvariantError, invariant } from "./invariant.js";

test("invariant throws InvariantError", () => {
  expect(() => {
    invariant(false, "x");
  }).toThrow(InvariantError);

  try {
    invariant(false, "x");
  } catch (error) {
    expect(error).toBeInstanceOf(InvariantError);
    expect(error).toMatchObject({ code: "INVARIANT_VIOLATION", message: "x" });
  }

  expect(() => {
    invariant(true, "x");
  }).not.toThrow();
});
