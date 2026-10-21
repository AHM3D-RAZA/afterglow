/**
 * Shared constants. World units are meters, +Y is up, and the room's open
 * "front" faces +Z (the camera looks toward -Z, at the back wall).
 *
 * Constants used by a single module live next to that module instead.
 */

export const RENDERER = {
  /** Capped: shadows and a full-screen canvas get expensive on 3x displays. */
  maxPixelRatio: 2,
  toneMappingExposure: 1.0,
  /** Intensity of the (very dim) image-based lighting used for reflections. */
  environmentIntensity: 0.22,
} as const;

export const CAMERA = {
  /** Vertical field of view in degrees at "wide" aspect ratios. */
  fov: 44,
  /** Never let the horizontal field of view drop below this (narrow windows). */
  minHorizontalFov: 62,
  /** Hard cap on the vertical field of view when compensating for narrow windows. */
  maxVerticalFov: 78,
  near: 0.1,
  far: 40,
  position: [1.3, 1.5, 2.0],
  lookAt: [0.2, 1.15, -3.3],
  drift: {
    /** Slow "breathing" sway that makes depth readable; disabled for reduced motion. */
    amplitude: 0.035,
    periodSeconds: 13,
  },
} as const;

export const ROOM = {
  halfWidth: 4,
  halfDepth: 4,
  height: 3.8,
  wallThickness: 0.2,
  dadoHeight: 1.1,
} as const;

/** Where the main set pieces stand. Lighting aims at these, so they live in one place. */
export const LAYOUT = {
  arcade: { position: [-1.95, 0, -3.3], rotationY: 0.2 },
  workbench: { position: [0.6, 0, -3.58] },
  shelving: { position: [2.95, 0, -3.72], rotationY: 0 },
} as const;

/** Hex colors shared by several modules. */
export const PALETTE = {
  /** Warm practical lighting (sodium-ish amber). */
  amberLight: 0xffb468,
  amberHot: 0xffc98a,
  /** Cool light spilling through the window. */
  coolLight: 0x8fb4de,
  /** Fog / void color: dark and slightly warm so distance fades into dusk. */
  haze: 0x16120f,
} as const;
