import { expect, test } from "vitest";
import { cameraSetMainCommand } from "./camera.js";
import { environmentSetCommand } from "./environment.js";
import { settingsSetCommand } from "./settings.js";

test("environment, settings, and camera command inputs reject invalid payloads", () => {
  expect(environmentSetCommand.input.safeParse({ patch: { exposure: 0 } }).success).toBe(false);
  expect(settingsSetCommand.input.safeParse({ patch: { units: "m" } }).success).toBe(false);
  expect(cameraSetMainCommand.input.safeParse({}).success).toBe(false);
  expect(environmentSetCommand.input.safeParse({ patch: {} }).success).toBe(true);
  expect(
    settingsSetCommand.input.safeParse({ patch: { mainCamera: "e_aaaaaaaaaa" } }).success,
  ).toBe(true);
});
