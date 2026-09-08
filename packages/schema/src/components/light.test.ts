import { expect, test } from "vitest";
import { LightSchema } from "./light.js";

test("light enum default and range", () => {
  expect(LightSchema.parse({ type: "directional" }).intensity).toBe(3);
  expect(LightSchema.parse({ type: "point" }).intensity).toBe(100);
  expect(LightSchema.parse({ type: "spot" }).intensity).toBe(200);
  expect(LightSchema.parse({ type: "area" }).intensity).toBe(5);
  expect(LightSchema.safeParse({ type: "spot", angle: 90 }).success).toBe(false);
  expect(LightSchema.safeParse({ type: "point", intensity: -1 }).success).toBe(false);
});
