import { expect, test } from "vitest";
import {
  candelaToBlenderPointWatts,
  candelaToGodotOmniLumens,
  candelaToGodotSpotLumens,
  candelaToUnityUrpPoint,
  luxToBlenderSunWattsPerSquareMeter,
  luxToUnityUrpSun,
  PHOTOPIC_LUMENS_PER_WATT,
  UNREAL_DIRECTIONAL_INTENSITY_UNITS,
  UNREAL_POINT_SPOT_INTENSITY_UNITS,
} from "./engine-conventions.js";

test("engine-conventions test vectors", () => {
  expect(PHOTOPIC_LUMENS_PER_WATT).toBe(683);
  expect(candelaToGodotOmniLumens(1)).toBeCloseTo(4 * Math.PI, 10);
  expect(candelaToGodotSpotLumens(1, Math.PI / 2)).toBeCloseTo(2 * Math.PI, 10);
  expect(luxToUnityUrpSun(3)).toBe(3);
  expect(candelaToUnityUrpPoint(100)).toBeCloseTo((100 * 4 * Math.PI) / 100, 10);
  expect(luxToBlenderSunWattsPerSquareMeter(683)).toBe(1);
  expect(candelaToBlenderPointWatts(683 / (4 * Math.PI))).toBeCloseTo(1, 10);
  expect(UNREAL_POINT_SPOT_INTENSITY_UNITS).toBe("Candelas");
  expect(UNREAL_DIRECTIONAL_INTENSITY_UNITS).toBe("Lux");
});
