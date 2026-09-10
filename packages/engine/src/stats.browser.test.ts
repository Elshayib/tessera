import { expect, test } from "vitest";
import { viewportStats } from "./stats.js";

test("stats drawCalls after render", () => {
  const stats = viewportStats(
    { drawCalls: 4, triangles: 12, textures: 2, geometries: 3, programs: 1 },
    8,
  );
  expect(stats.drawCalls).toBe(4);
  expect(stats.triangles).toBe(12);
  expect(stats.textures).toBe(2);
  expect(stats.geometries).toBe(3);
  expect(stats.programs).toBe(1);
  expect(stats.frameMs).toBe(8);
  expect(stats.fps).toBe(125);
});

test("stats fps is 0 when frameMs is 0", () => {
  const stats = viewportStats(
    { drawCalls: 1, triangles: 0, textures: 0, geometries: 0, programs: 0 },
    0,
  );
  expect(stats.fps).toBe(0);
  expect(stats.frameMs).toBe(0);
});
