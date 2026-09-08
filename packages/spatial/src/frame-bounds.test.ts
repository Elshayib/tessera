import { isErr, isOk } from "@tessera/std";
import { expect, test } from "vitest";
import { frameBounds } from "./frame-bounds.js";

test("frameBounds padding", () => {
  const box = { min: [0, 0, 0], max: [2, 2, 2] };
  const tight = frameBounds([box], 0);
  const padded = frameBounds([box], 1);
  expect(isOk(tight) && isOk(padded)).toBe(true);
  if (!isOk(tight) || !isOk(padded)) {
    return;
  }
  expect(padded.value.padding).toBe(1);
  expect(padded.value.distance).toBeGreaterThan(tight.value.distance);
  expect(padded.value.target).toEqual(padded.value.center);
  expect(tight.value.center).toEqual([1, 1, 1]);
  const two = frameBounds([box, { min: [10, 0, 0], max: [12, 2, 2] }], 0);
  expect(isOk(two) && two.value.center[0] === 6).toBe(true);
  const empty = frameBounds([]);
  expect(isErr(empty) && empty.error.code === "INVALID_INPUT").toBe(true);
  const negative = frameBounds([box], -4);
  expect(isOk(negative) && negative.value.padding === 0).toBe(true);
});
