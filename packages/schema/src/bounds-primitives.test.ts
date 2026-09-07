import { expect, test } from "vitest";
import { primitiveBounds } from "./bounds-primitives.js";

test("primitive bounds", () => {
  expect(primitiveBounds({ type: "box", size: [2, 4, 6] })).toEqual({
    min: [-1, -2, -3],
    max: [1, 2, 3],
  });
  expect(primitiveBounds({ type: "sphere", radius: 2, segments: 8 })).toEqual({
    min: [-2, -2, -2],
    max: [2, 2, 2],
  });
  expect(
    primitiveBounds({ type: "cylinder", radiusTop: 1, radiusBottom: 2, height: 4, segments: 8 }),
  ).toEqual({
    min: [-2, -2, -2],
    max: [2, 2, 2],
  });
  expect(primitiveBounds({ type: "cone", radius: 3, height: 2, segments: 8 })).toEqual({
    min: [-3, -1, -3],
    max: [3, 1, 3],
  });
  expect(primitiveBounds({ type: "plane", size: [4, 6] })).toEqual({
    min: [-2, 0, -3],
    max: [2, 0, 3],
  });
  expect(
    primitiveBounds({ type: "torus", radius: 2, tube: 0.5, radialSegments: 8, tubularSegments: 8 }),
  ).toEqual({
    min: [-2.5, -0.5, -2.5],
    max: [2.5, 0.5, 2.5],
  });
  expect(primitiveBounds({ type: "capsule", radius: 1, height: 4, segments: 8 })).toEqual({
    min: [-1, -2, -1],
    max: [1, 2, 1],
  });
});
