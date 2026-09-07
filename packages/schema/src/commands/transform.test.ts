import { expect, test } from "vitest";
import {
  transformRotateCommand,
  transformScaleCommand,
  transformSetCommand,
  transformTranslateCommand,
} from "./transform.js";

const ENTITY = "e_aaaaaaaaaa";

test("transform command inputs reject invalid payloads", () => {
  expect(transformSetCommand.input.safeParse({ target: ENTITY, position: [1, 2] }).success).toBe(
    false,
  );
  expect(transformTranslateCommand.input.safeParse({ target: ENTITY }).success).toBe(false);
  expect(
    transformRotateCommand.input.safeParse({ target: ENTITY, delta: [0, 0, 0], space: "screen" })
      .success,
  ).toBe(false);
  expect(transformScaleCommand.input.safeParse({ target: ENTITY, factor: 0 }).success).toBe(false);
  expect(transformScaleCommand.input.safeParse({ target: ENTITY, factor: [1, 1, 1] }).success).toBe(
    true,
  );
});
