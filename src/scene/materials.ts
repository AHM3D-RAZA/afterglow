import { Color, DoubleSide, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';
import { PALETTE } from '../config';
import {
  blockWallRecipe,
  cardboardRecipe,
  chippedMetalRecipe,
  concreteFloorRecipe,
  pegboardRecipe,
  woodRecipe,
} from '../procedural/recipes';
import { createSurfaceTextures, type SurfaceRecipe } from '../procedural/surfaces';

/**
 * Every material in the workshop, created once and shared.
 * Textured materials come from procedural recipes; their roughness is encoded
 * in the detail map, so `roughness` is left at 1 for them.
 */
export function createMaterials() {
  /** Material using a generated albedo map and a combined roughness/bump map. */
  const surface = (
    recipe: SurfaceRecipe,
    params: MeshStandardMaterialParameters & { bumpScale?: number } = {},
  ): MeshStandardMaterial => {
    const { map, detailMap } = createSurfaceTextures(recipe);
    return new MeshStandardMaterial({
      map,
      roughnessMap: detailMap,
      bumpMap: detailMap,
      bumpScale: 1.2,
      roughness: 1,
      metalness: 0,
      ...params,
    });
  };

  const solid = (color: number, roughness: number, metalness = 0): MeshStandardMaterial =>
    new MeshStandardMaterial({ color, roughness, metalness });

  const paintedSteel = (
    seed: number,
    baseColor: [number, number, number],
    mottleColor: [number, number, number],
    grimeColor: [number, number, number],
    options: { wear?: number; resolution?: 256 | 512; metalness?: number } = {},
  ): MeshStandardMaterial =>
    surface(
      chippedMetalRecipe({
        seed,
        resolution: options.resolution ?? 512,
        baseColor,
        mottleColor,
        grimeColor,
        wear: options.wear ?? 1,
      }),
      { metalness: options.metalness ?? 0.45 },
    );

  const glow = (color: number, intensity: number): MeshStandardMaterial =>
    new MeshStandardMaterial({
      color: new Color(color).multiplyScalar(0.15),
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
    });

  return {
    // --- Architecture ---
    concreteFloor: surface(concreteFloorRecipe(), { bumpScale: 1.6 }),
    wallUpper: surface(
      blockWallRecipe({
        seed: 2201,
        baseColor: [152, 144, 122],
        mottleColor: [176, 166, 138],
        grimeColor: [64, 55, 42],
        grimeCoverage: 0.28,
        exposedColor: 'rgb(178,170,152)',
      }),
      { bumpScale: 2 },
    ),
    wallDado: surface(
      blockWallRecipe({
        seed: 2202,
        baseColor: [52, 80, 74],
        mottleColor: [68, 98, 90],
        grimeColor: [22, 28, 26],
        grimeCoverage: 0.3,
        exposedColor: 'rgb(150,150,134)',
      }),
      { bumpScale: 2 },
    ),
    ceiling: paintedSteel(2301, [38, 40, 42], [52, 54, 56], [16, 16, 16], { metalness: 0.2 }),
    beam: paintedSteel(2302, [58, 64, 68], [78, 84, 86], [24, 24, 24], { wear: 1.2 }),
    trim: solid(0x1f2326, 0.6, 0.3),

    // --- Furniture and storage ---
    benchWood: surface(woodRecipe(), { bumpScale: 1 }),
    shelfBoard: surface(woodRecipe(), { color: 0xc4b29a, bumpScale: 1 }),
    crateWood: surface(woodRecipe(), { color: 0x9b9486, bumpScale: 1.4 }),
    shelfSteel: paintedSteel(3101, [66, 86, 104], [84, 106, 124], [26, 32, 38], { wear: 1.5 }),
    arcadeBody: paintedSteel(7001, [30, 44, 66], [42, 58, 82], [12, 16, 22], { wear: 0.35, metalness: 0.15 }),
    darkSteel: paintedSteel(3102, [42, 46, 50], [58, 62, 66], [16, 16, 16], { wear: 1.3 }),
    cardboard: surface(cardboardRecipe(), { bumpScale: 0.8 }),
    pegboard: surface(pegboardRecipe(), { bumpScale: 1.5 }),

    // --- Props ---
    drumRust: paintedSteel(4101, [118, 56, 42], [146, 78, 54], [38, 22, 16], { wear: 1.8, resolution: 256 }),
    drumBlue: paintedSteel(4102, [44, 74, 98], [60, 92, 116], [20, 28, 34], { wear: 1.6, resolution: 256 }),
    toolboxRed: paintedSteel(4103, [138, 52, 42], [164, 70, 56], [44, 20, 16], { wear: 1.4, resolution: 256 }),
    rawSteel: solid(0x8d9195, 0.42, 0.9),
    darkIron: solid(0x2a2c2e, 0.55, 0.85),
    rubber: solid(0x151515, 0.92),
    plastic: solid(0x70757a, 0.55),
    plasticAmber: solid(0xa27a3a, 0.5),
    ceramic: solid(0xb7b0a0, 0.35),
    fabric: solid(0x7b705f, 1),
    tarpBlue: solid(0x3d596b, 0.85),
    tarpOlive: solid(0x5b6540, 0.9),
    labelRed: solid(0x86312a, 0.6),
    labelBlue: solid(0x2f5d7c, 0.6),
    labelMustard: solid(0xc29a3a, 0.6),
    circuitBoard: solid(0x1f4a32, 0.5),
    chip: solid(0x101112, 0.4),
    gold: solid(0xb08a3a, 0.35, 1),
    /** Dirty off-white enamel; double-sided because lamp shades are open cones. */
    enamelShade: new MeshStandardMaterial({ color: 0xa9a699, roughness: 0.5, metalness: 0.3, side: DoubleSide }),
    glassDark: new MeshStandardMaterial({ color: 0x020303, roughness: 0.22, metalness: 0 }),

    // --- Emissives ---
    bulbOn: glow(PALETTE.amberHot, 5),
    bulbOff: solid(0x3a3935, 0.25),
    windowGlow: glow(0xa9c7e8, 2.2),
  };
}

export type WorkshopMaterials = ReturnType<typeof createMaterials>;
