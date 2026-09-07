import { expect, test } from "vitest";
import { CameraSchema } from "./camera.js";

test("camera defaults and range", () => {
  const camera = CameraSchema.parse({});
  expect(camera.type).toBe("perspective");
  expect(camera.fov).toBe(50);
  expect(CameraSchema.safeParse({ fov: 1 }).success).toBe(false);
  expect(CameraSchema.safeParse({ near: 10, far: 1 }).success).toBe(false);
});
