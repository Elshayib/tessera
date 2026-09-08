import { expect, test } from "vitest";
import { TransformSchema } from "./transform.js";

test("transform defaults and range", () => {
  expect(TransformSchema.parse({})).toEqual({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  });
  expect(TransformSchema.safeParse({ scale: [1, 0, 1] }).success).toBe(false);
  expect(TransformSchema.safeParse({ position: [Number.NaN, 0, 0] }).success).toBe(false);
});
