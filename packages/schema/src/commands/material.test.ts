import { expect, test } from "vitest";
import { materialAssignCommand, materialCreateCommand, materialSetCommand } from "./material.js";

test("material command inputs reject invalid payloads", () => {
  expect(materialCreateCommand.input.safeParse({ name: "" }).success).toBe(false);
  expect(materialSetCommand.input.safeParse({ target: "a_aaaaaaaaaa" }).success).toBe(false);
  expect(
    materialAssignCommand.input.safeParse({
      target: "e_aaaaaaaaaa",
      material: "a_aaaaaaaaaa",
      slot: -1,
    }).success,
  ).toBe(false);
  expect(materialCreateCommand.input.safeParse({}).success).toBe(true);
});
