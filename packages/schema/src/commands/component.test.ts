import { expect, test } from "vitest";
import { componentAddCommand, componentRemoveCommand, componentSetCommand } from "./component.js";

const ENTITY = "e_aaaaaaaaaa";

test("component command inputs reject invalid payloads", () => {
  expect(componentAddCommand.input.safeParse({ target: ENTITY, type: "instance" }).success).toBe(
    false,
  );
  expect(componentRemoveCommand.input.safeParse({ target: ENTITY }).success).toBe(false);
  expect(
    componentSetCommand.input.safeParse({
      target: ENTITY,
      type: "transform",
      patch: { scale: [1, 0, 1] },
    }).success,
  ).toBe(false);
  expect(
    componentAddCommand.input.safeParse({
      target: ENTITY,
      type: "meshRenderer",
      value: { geometry: "a_aaaaaaaaaa" },
    }).success,
  ).toBe(true);
});
