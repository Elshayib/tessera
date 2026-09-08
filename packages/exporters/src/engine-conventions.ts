/**
 * Engine conversion table (`09` §5). Bridges duplicate these constants; the glTF stays meters, Y-up
 * (`INV-EXP-06`).
 *
 * @public
 */
export const PHOTOPIC_LUMENS_PER_WATT = 683;

/**
 * Godot 4 omni: `lm = cd × 4π` (`09` §5).
 *
 * @example
 * ```ts
 * candelaToGodotOmniLumens(1);
 * ```
 *
 * @public
 */
export function candelaToGodotOmniLumens(candela: number): number {
  return candela * 4 * Math.PI;
}

/**
 * Godot 4 spot: `lm = cd × 2π(1 − cos(angle))` (`09` §5).
 *
 * @public
 */
export function candelaToGodotSpotLumens(candela: number, outerAngleRadians: number): number {
  return candela * 2 * Math.PI * (1 - Math.cos(outerAngleRadians));
}

/**
 * Unity URP directional: `1 lux ≈ 1 unit` (`09` §5).
 *
 * @public
 */
export function luxToUnityUrpSun(lux: number): number {
  return lux;
}

/**
 * Unity URP point: `cd × 4π / 100` (`09` §5).
 *
 * @public
 */
export function candelaToUnityUrpPoint(candela: number): number {
  return (candela * 4 * Math.PI) / 100;
}

/**
 * Blender sun: `W/m² = lux / 683` (`09` §5).
 *
 * @public
 */
export function luxToBlenderSunWattsPerSquareMeter(lux: number): number {
  return lux / PHOTOPIC_LUMENS_PER_WATT;
}

/**
 * Blender point: `W = cd × 4π / 683` (`09` §5).
 *
 * @public
 */
export function candelaToBlenderPointWatts(candela: number): number {
  return (candela * 4 * Math.PI) / PHOTOPIC_LUMENS_PER_WATT;
}

/**
 * Unreal 5.7 intensity units for punctual lights (`09` §5).
 *
 * @public
 */
export const UNREAL_POINT_SPOT_INTENSITY_UNITS = "Candelas" as const;

/**
 * Unreal 5.7 intensity units for directional lights (`09` §5).
 *
 * @public
 */
export const UNREAL_DIRECTIONAL_INTENSITY_UNITS = "Lux" as const;
