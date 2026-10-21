import { randomBetween, type Rng } from './random';
import type { Rgb, SurfaceRecipe } from './surfaces';

/**
 * Surface recipes for the workshop. Colors are muted and slightly desaturated;
 * the warm/cool contrast comes from the lighting, not from the albedo.
 *
 * Detail callbacks must pick random numbers BEFORE drawing: each shape is
 * painted onto two canvases, so randomness consumed inside a draw callback
 * would make the albedo and detail maps disagree.
 */

type Point = readonly [number, number];

const INK = 'rgb(18,16,15)';

export function concreteFloorRecipe(): SurfaceRecipe {
  return {
    seed: 1101,
    resolution: 1024,
    tileMeters: 4,
    baseColor: [76, 78, 78],
    mottleColor: [102, 103, 100],
    grimeColor: [40, 37, 34],
    grimeCoverage: 0.38,
    grain: 0.4,
    roughness: [0.55, 0.95],
    details(d) {
      // Expansion joints on the slab edges (drawn at both edges so the tile wraps cleanly).
      for (const edge of [0, d.size]) {
        d.strokePath((c) => { c.moveTo(edge, 0); c.lineTo(edge, d.size); }, { color: INK, value: 0.08, alpha: 0.9 }, 7);
        d.strokePath((c) => { c.moveTo(0, edge); c.lineTo(d.size, edge); }, { color: INK, value: 0.08, alpha: 0.9 }, 7);
      }

      // Newer, lighter patch repairs.
      for (let i = 0; i < 3; i++) {
        const x = randomBetween(d.rng, 0, d.size);
        const y = randomBetween(d.rng, 0, d.size);
        const w = randomBetween(d.rng, 60, 150);
        const h = randomBetween(d.rng, 40, 100);
        d.fillPath((c) => c.rect(x, y, w, h), { color: 'rgb(110,112,110)', value: 0.5, alpha: 0.16 });
      }

      // Cracks: a main fracture with a hairline branch.
      for (let i = 0; i < 4; i++) {
        const start: Point = [randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size)];
        const main = wanderingPoints(d.rng, start, 70, 11, d.rng() * Math.PI * 2, 0.55);
        d.strokePath(polyline(main), { color: INK, value: 0.05, alpha: 0.85 }, 2.2);
        const branchOrigin = main[Math.floor(main.length * 0.5)] ?? start;
        const branch = wanderingPoints(d.rng, branchOrigin, 28, 9, d.rng() * Math.PI * 2, 0.7);
        d.strokePath(polyline(branch), { color: INK, value: 0.05, alpha: 0.6 }, 1.2);
      }

      // Old oil and water stains: dark, smooth (low roughness value), soft-edged.
      for (let i = 0; i < 7; i++) {
        const radius = randomBetween(d.rng, 36, 120);
        d.blob(randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size), radius, {
          color: 'rgb(14,12,11)',
          value: 0.12,
          alpha: randomBetween(d.rng, 0.35, 0.6),
        });
      }

      // Faint drag marks where heavy things were slid across the slab.
      for (let i = 0; i < 6; i++) {
        const start: Point = [randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size)];
        const end: Point = [start[0] + randomBetween(d.rng, -200, 200), start[1] + randomBetween(d.rng, -200, 200)];
        d.strokePath((c) => { c.moveTo(...start); c.lineTo(...end); }, { color: 'rgb(150,146,138)', value: 0.4, alpha: 0.1 }, 3);
      }
    },
  };
}

export interface BlockWallOptions {
  seed: number;
  baseColor: Rgb;
  mottleColor: Rgb;
  grimeColor: Rgb;
  grimeCoverage: number;
  /** Color of exposed plaster where paint has peeled. */
  exposedColor: string;
}

/** Painted concrete-block wall: 0.4 m x 0.2 m blocks, one repeat = 1.6 m. */
export function blockWallRecipe(options: BlockWallOptions): SurfaceRecipe {
  return {
    seed: options.seed,
    resolution: 1024,
    tileMeters: 1.6,
    baseColor: options.baseColor,
    mottleColor: options.mottleColor,
    grimeColor: options.grimeColor,
    grimeCoverage: options.grimeCoverage,
    grain: 0.3,
    roughness: [0.6, 0.95],
    details(d) {
      const blockWidth = d.size / 4;
      const blockHeight = d.size / 8;

      // Slight per-block tonal variation, so the paint reads as hand-applied.
      for (let row = 0; row < 8; row++) {
        for (let column = -1; column < 4; column++) {
          const x = column * blockWidth + (row % 2 === 0 ? 0 : blockWidth / 2);
          const lighten = d.rng() > 0.5;
          const alpha = randomBetween(d.rng, 0.02, 0.1);
          d.fillPath((c) => c.rect(x, row * blockHeight, blockWidth, blockHeight), {
            color: lighten ? 'rgb(255,244,226)' : 'rgb(0,0,0)',
            value: 0.7,
            alpha,
          });
        }
      }

      // Recessed mortar joints.
      const mortar = { color: 'rgb(30,28,25)', value: 0.12, alpha: 0.55 };
      for (let row = 0; row <= 8; row++) {
        const y = row * blockHeight;
        d.strokePath((c) => { c.moveTo(0, y); c.lineTo(d.size, y); }, mortar, 6);
      }
      for (let row = 0; row < 8; row++) {
        const offset = row % 2 === 0 ? 0 : blockWidth / 2;
        for (let column = -1; column <= 4; column++) {
          const x = column * blockWidth + offset;
          d.strokePath((c) => { c.moveTo(x, row * blockHeight); c.lineTo(x, (row + 1) * blockHeight); }, mortar, 6);
        }
      }

      // Vertical water streaks running down from above.
      for (let i = 0; i < 14; i++) {
        const x = randomBetween(d.rng, 0, d.size);
        const y = randomBetween(d.rng, 0, d.size);
        const endX = x + randomBetween(d.rng, -6, 6);
        const endY = y + randomBetween(d.rng, 120, 420);
        d.strokePath((c) => { c.moveTo(x, y); c.lineTo(endX, endY); }, { color: 'rgb(22,20,16)', value: 0.5, alpha: 0.07 }, randomBetween(d.rng, 6, 20));
      }

      // Peeled paint exposing pale plaster.
      for (let i = 0; i < 3; i++) {
        const patch = raggedPath(d.rng, randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 14, 40));
        d.fillPath(patch, { color: options.exposedColor, value: 0.95, alpha: 0.65 });
      }
    },
  };
}

export function woodRecipe(): SurfaceRecipe {
  return {
    seed: 3303,
    resolution: 512,
    tileMeters: 1.2,
    baseColor: [98, 72, 46],
    mottleColor: [146, 110, 72],
    grimeColor: [36, 27, 20],
    grimeCoverage: 0.4,
    grain: 0.5,
    roughness: [0.5, 0.9],
    // Few cells along x, many along y: long streaks that read as wood grain.
    mottleCells: [2, 36],
    details(d) {
      const plankCount = 4;
      const plankHeight = d.size / plankCount;

      for (let plank = 0; plank <= plankCount; plank++) {
        const y = plank * plankHeight;
        d.strokePath((c) => { c.moveTo(0, y); c.lineTo(d.size, y); }, { color: 'rgb(20,14,10)', value: 0.05, alpha: 0.9 }, 4);
      }
      for (let plank = 0; plank < plankCount; plank++) {
        const x = randomBetween(d.rng, 0.15, 0.85) * d.size;
        d.strokePath((c) => { c.moveTo(x, plank * plankHeight); c.lineTo(x, (plank + 1) * plankHeight); }, { color: 'rgb(20,14,10)', value: 0.05, alpha: 0.8 }, 3);
      }

      // Knots.
      for (let i = 0; i < 5; i++) {
        const x = randomBetween(d.rng, 0, d.size);
        const y = randomBetween(d.rng, 0, d.size);
        for (const [radius, alpha] of [[14, 0.25], [9, 0.35], [4, 0.6]] as const) {
          d.strokePath((c) => c.ellipse(x, y, radius * 1.8, radius, 0, 0, Math.PI * 2), { color: 'rgb(34,22,14)', value: 0.3, alpha }, 2.5);
        }
      }

      // Mug rings and spilled-oil darkening.
      for (let i = 0; i < 3; i++) {
        const x = randomBetween(d.rng, 40, d.size - 40);
        const y = randomBetween(d.rng, 40, d.size - 40);
        d.strokePath((c) => c.arc(x, y, 22, 0, Math.PI * 2), { color: 'rgb(30,20,14)', value: 0.35, alpha: 0.35 }, 3);
      }
      for (let i = 0; i < 4; i++) {
        d.blob(randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 30, 70), { color: 'rgb(16,11,8)', value: 0.2, alpha: 0.4 });
      }
    },
  };
}

export interface ChippedMetalOptions {
  seed: number;
  /** Texture resolution in pixels; small props can use 256. */
  resolution: 256 | 512;
  baseColor: Rgb;
  mottleColor: Rgb;
  grimeColor: Rgb;
  /** Density multiplier for paint chips and scratches. */
  wear: number;
}

/** Painted steel with chipped paint, scratches and rust bloom. One repeat = 1 m. */
export function chippedMetalRecipe(options: ChippedMetalOptions): SurfaceRecipe {
  return {
    seed: options.seed,
    resolution: options.resolution,
    tileMeters: 1,
    baseColor: options.baseColor,
    mottleColor: options.mottleColor,
    grimeColor: options.grimeColor,
    grimeCoverage: 0.4,
    grain: 0.25,
    roughness: [0.35, 0.8],
    details(d) {
      const scale = d.size / 512;
      // Chips that expose bare, smooth steel.
      for (let i = 0; i < 240 * options.wear * scale; i++) {
        const radius = randomBetween(d.rng, 1.2, 4.5) * scale;
        const patch = raggedPath(d.rng, randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size), radius, 5);
        d.fillPath(patch, { color: 'rgb(168,170,172)', value: 0.12, alpha: 0.8 });
      }
      // Rust blooming around some of the chips.
      for (let i = 0; i < 34 * options.wear * scale; i++) {
        d.blob(randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 5, 16) * scale, { color: 'rgb(116,64,36)', value: 0.9, alpha: 0.55 });
      }
      // Scratches.
      for (let i = 0; i < 70 * options.wear * scale; i++) {
        const x = randomBetween(d.rng, 0, d.size);
        const y = randomBetween(d.rng, 0, d.size);
        const angle = d.rng() * Math.PI;
        const length = randomBetween(d.rng, 14, 80) * scale;
        d.strokePath((c) => { c.moveTo(x, y); c.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length); }, { color: 'rgb(196,196,196)', value: 0.2, alpha: 0.22 }, 1);
      }
    },
  };
}

export function cardboardRecipe(): SurfaceRecipe {
  return {
    seed: 5505,
    resolution: 256,
    tileMeters: 0.5,
    baseColor: [146, 108, 70],
    mottleColor: [174, 134, 92],
    grimeColor: [68, 50, 32],
    grimeCoverage: 0.3,
    grain: 0.4,
    roughness: [0.75, 0.98],
    details(d) {
      // Corrugation flutes show faintly through the liner.
      for (let y = 0; y < d.size; y += 6) {
        d.strokePath((c) => { c.moveTo(0, y); c.lineTo(d.size, y); }, { color: 'rgb(60,40,24)', value: 0.6, alpha: 0.07 }, 2);
      }
      for (let i = 0; i < 6; i++) {
        d.blob(randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 16, 40), { color: 'rgb(54,38,24)', value: 0.8, alpha: 0.3 });
      }
    },
  };
}

/** Painted hardboard with a 25 mm grid of holes. One repeat = 0.4 m = 16 holes. */
export function pegboardRecipe(): SurfaceRecipe {
  return {
    seed: 6606,
    resolution: 512,
    tileMeters: 0.4,
    baseColor: [70, 78, 80],
    mottleColor: [86, 94, 94],
    grimeColor: [30, 30, 28],
    grimeCoverage: 0.05,
    grain: 0.3,
    roughness: [0.6, 0.95],
    details(d) {
      const spacing = d.size / 16;
      for (let row = 0; row < 16; row++) {
        for (let column = 0; column < 16; column++) {
          const x = (column + 0.5) * spacing;
          const y = (row + 0.5) * spacing;
          d.fillPath((c) => c.arc(x, y, 4.5, 0, Math.PI * 2), { color: 'rgb(7,7,8)', value: 0.02, alpha: 0.92 });
        }
      }
    },
  };
}

/** A closed, irregular polygon around (x, y). Points are fixed up front. */
function raggedPath(rng: Rng, x: number, y: number, radius: number, vertexCount = 7) {
  const points: Point[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2;
    const r = radius * randomBetween(rng, 0.5, 1.2);
    points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r]);
  }
  return (ctx: CanvasRenderingContext2D): void => {
    points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
  };
}

/** A meandering path: each step turns by a random amount up to `wander` radians. */
function wanderingPoints(rng: Rng, start: Point, steps: number, stepLength: number, heading: number, wander: number): Point[] {
  const points: Point[] = [start];
  let [x, y] = start;
  let angle = heading;
  for (let i = 0; i < steps; i++) {
    angle += randomBetween(rng, -wander, wander);
    x += Math.cos(angle) * stepLength;
    y += Math.sin(angle) * stepLength;
    points.push([x, y]);
  }
  return points;
}

function polyline(points: readonly Point[]) {
  return (ctx: CanvasRenderingContext2D): void => {
    points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  };
}
