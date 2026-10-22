import { smoothstep } from './noise';
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
const WOOD_PLANKS = 4;

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
    // Dirt packs into the slab joints, which sit on the tile border.
    grimeBias: (u, v) => 0.22 * (1 - smoothstep(0, 0.035, Math.min(u, 1 - u, v, 1 - v))),
    details(d) {
      // Expansion joints on the slab edges (drawn at both edges so the tile wraps cleanly):
      // a wide faint band of packed dirt, then the thin dark line.
      for (const edge of [0, d.size]) {
        d.strokePath((c) => { c.moveTo(edge, 0); c.lineTo(edge, d.size); }, { color: INK, value: 0.15, alpha: 0.16 }, 22);
        d.strokePath((c) => { c.moveTo(0, edge); c.lineTo(d.size, edge); }, { color: INK, value: 0.15, alpha: 0.16 }, 22);
        d.strokePath((c) => { c.moveTo(edge, 0); c.lineTo(edge, d.size); }, { color: INK, value: 0.08, alpha: 0.9 }, 7);
        d.strokePath((c) => { c.moveTo(0, edge); c.lineTo(d.size, edge); }, { color: INK, value: 0.08, alpha: 0.9 }, 7);
      }

      // Pale, dusty patches where old repairs and cement dust have dried.
      for (let i = 0; i < 2; i++) {
        d.stain(
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 70, 120),
          { color: 'rgb(118,119,116)', value: 0.55, alpha: 0.14 },
          { softness: 0.9, stretch: randomBetween(d.rng, 1.5, 2.2), angle: d.rng() * Math.PI },
        );
      }

      // Cracks: a faint band of dirt in the crack, the dark fracture, and a hairline branch.
      for (let i = 0; i < 4; i++) {
        const start: Point = [randomBetween(d.rng, 0, d.size), randomBetween(d.rng, 0, d.size)];
        const main = wanderingPoints(d.rng, start, 70, 11, d.rng() * Math.PI * 2, 0.55);
        d.strokePath(polyline(main), { color: INK, value: 0.15, alpha: 0.14 }, 8);
        d.strokePath(polyline(main), { color: INK, value: 0.05, alpha: 0.85 }, 2.2);
        const branchOrigin = main[Math.floor(main.length * 0.5)] ?? start;
        const branch = wanderingPoints(d.rng, branchOrigin, 28, 9, d.rng() * Math.PI * 2, 0.7);
        d.strokePath(polyline(branch), { color: INK, value: 0.05, alpha: 0.6 }, 1.2);
      }

      // Old oil and water stains: dark, smooth (low roughness value), irregular and elongated.
      for (let i = 0; i < 5; i++) {
        d.stain(
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 30, 85),
          { color: 'rgb(14,12,11)', value: 0.12, alpha: randomBetween(d.rng, 0.3, 0.5) },
          { softness: 0.75, stretch: randomBetween(d.rng, 1.3, 2.4), angle: d.rng() * Math.PI },
        );
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
  /**
   * Extra grime near the foot of the wall (splashes, dust, damp), as a noise
   * offset; 0 for none. Only meaningful for a wall whose bottom edge is the floor,
   * because the texture's vertical position repeats every tile.
   */
  baseGrime: number;
}

const BLOCK_COLUMNS = 4;
const BLOCK_ROWS = 8;
/** Distance from a mortar joint, in tile units, within which dirt is drawn into it. */
const JOINT_DIRT_REACH = 0.012;
/** Height above the floor, in tile units (0.5 m of a 1.6 m tile), over which base grime fades out. */
const BASE_GRIME_REACH = 0.31;

/** 1 on a mortar joint, falling to 0 a couple of centimeters away. Mirrors the layout drawn in `details`. */
function blockJointCloseness(u: number, v: number): number {
  const rowPosition = (1 - v) * BLOCK_ROWS; // canvas rows run top-down
  const row = Math.min(BLOCK_ROWS - 1, Math.floor(rowPosition));
  const toBedJoint = Math.abs(rowPosition - Math.round(rowPosition)) / BLOCK_ROWS;
  const columnPosition = u * BLOCK_COLUMNS - (row % 2 === 0 ? 0 : 0.5);
  const toHeadJoint = Math.abs(columnPosition - Math.round(columnPosition)) / BLOCK_COLUMNS;
  return 1 - smoothstep(0, JOINT_DIRT_REACH, Math.min(toBedJoint, toHeadJoint));
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
    // Tall, drip-like discoloration; dirt collects in the joints and at the foot of the wall.
    grimeCells: [5, 2],
    grimeBias: (u, v) =>
      0.16 * blockJointCloseness(u, v) + options.baseGrime * (1 - smoothstep(0, BASE_GRIME_REACH, v)),
    details(d) {
      const blockWidth = d.size / BLOCK_COLUMNS;
      const blockHeight = d.size / BLOCK_ROWS;

      // Slight per-block tonal variation, so the paint reads as hand-applied.
      for (let row = 0; row < BLOCK_ROWS; row++) {
        for (let column = -1; column < BLOCK_COLUMNS; column++) {
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
      for (let row = 0; row <= BLOCK_ROWS; row++) {
        const y = row * blockHeight;
        d.strokePath((c) => { c.moveTo(0, y); c.lineTo(d.size, y); }, mortar, 6);
      }
      for (let row = 0; row < BLOCK_ROWS; row++) {
        const offset = row % 2 === 0 ? 0 : blockWidth / 2;
        for (let column = -1; column <= BLOCK_COLUMNS; column++) {
          const x = column * blockWidth + offset;
          d.strokePath((c) => { c.moveTo(x, row * blockHeight); c.lineTo(x, (row + 1) * blockHeight); }, mortar, 6);
        }
      }

      // Water streaks running down from above: tall, narrow, irregular stains.
      for (let i = 0; i < 3; i++) {
        d.stain(
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 7, 13),
          { color: 'rgb(22,20,16)', value: 0.5, alpha: randomBetween(d.rng, 0.04, 0.07) },
          { softness: 0.8, stretch: randomBetween(d.rng, 8, 16), angle: Math.PI / 2 + randomBetween(d.rng, -0.06, 0.06) },
        );
      }

      // Peeled paint exposing pale plaster: crisp but ragged, and only partly opaque.
      for (let i = 0; i < 2; i++) {
        d.stain(
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 12, 24),
          { color: options.exposedColor, value: 0.95, alpha: 0.5 },
          { softness: 0.25, stretch: randomBetween(d.rng, 1.3, 2), angle: d.rng() * Math.PI },
        );
      }
    },
  };
}

/** Planked wood. Each use should pass its own seed so no two objects share identical grain. */
export function woodRecipe(seed: number): SurfaceRecipe {
  return {
    seed,
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
    // Dirt works into the seams between planks.
    grimeBias: (_u, v) => {
      const seam = Math.abs((1 - v) * WOOD_PLANKS - Math.round((1 - v) * WOOD_PLANKS)) / WOOD_PLANKS;
      return 0.18 * (1 - smoothstep(0, 0.012, seam));
    },
    details(d) {
      const plankHeight = d.size / WOOD_PLANKS;

      for (let plank = 0; plank <= WOOD_PLANKS; plank++) {
        const y = plank * plankHeight;
        d.strokePath((c) => { c.moveTo(0, y); c.lineTo(d.size, y); }, { color: 'rgb(20,14,10)', value: 0.05, alpha: 0.9 }, 4);
      }
      for (let plank = 0; plank < WOOD_PLANKS; plank++) {
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

      // Mug rings: partial, uneven arcs rather than clean circles.
      for (let i = 0; i < 3; i++) {
        const x = randomBetween(d.rng, 40, d.size - 40);
        const y = randomBetween(d.rng, 40, d.size - 40);
        const start = d.rng() * Math.PI * 2;
        const sweep = randomBetween(d.rng, 4, 5.6);
        const width = randomBetween(d.rng, 2, 3.5);
        d.strokePath((c) => c.arc(x, y, 22, start, start + sweep), { color: 'rgb(30,20,14)', value: 0.35, alpha: 0.28 }, width);
      }

      // Spilled-oil darkening, drawn out along the grain.
      for (let i = 0; i < 4; i++) {
        d.stain(
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 24, 55),
          { color: 'rgb(16,11,8)', value: 0.2, alpha: 0.34 },
          { softness: 0.8, stretch: randomBetween(d.rng, 1.8, 3.5), angle: randomBetween(d.rng, -0.1, 0.1) },
        );
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

/**
 * Painted steel with chipped paint, scratches and rust. One repeat = 1 m.
 * Wear is clustered where a low-frequency mask says the paint is thin, and chips
 * expose dark primer rather than bright metal; evenly scattered bright flecks
 * read as a starfield, not as damage.
 */
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
    grimeCells: [4, 4],
    details(d) {
      /** Millimeters to pixels, never below one pixel so tiny chips stay visible. */
      const mm = (millimeters: number): number => Math.max(0.9, (millimeters * d.pixelsPerMeter) / 1000);
      const wear = d.noiseField(5, 3);

      /** A random point, biased toward the worn parts of the paint. */
      const wornPoint = (): Point => {
        let x = 0;
        let y = 0;
        for (let attempt = 0; attempt < 12; attempt++) {
          x = d.rng() * d.size;
          y = d.rng() * d.size;
          if (d.rng() < smoothstep(0.35, 0.7, wear[Math.floor(y) * d.size + Math.floor(x)])) break;
        }
        return [x, y];
      };

      // Chips: mostly tiny, a few large. A dark rim, then primer-colored core.
      for (let i = 0; i < Math.round(110 * options.wear); i++) {
        const [x, y] = wornPoint();
        const radiusMm = 1.2 + 8 * d.rng() ** 3;
        const radius = mm(radiusMm);
        const rim = raggedPath(d.rng, x, y, radius * 1.35, 6);
        const core = raggedPath(d.rng, x, y, radius, 6);
        // Larger chips let rust run down from them. Drawn first so the chip sits on top.
        if (radiusMm > 6.5) {
          d.stain(
            x,
            y + radius * 0.8,
            radius * 2.4,
            { color: 'rgb(104,60,40)', value: 0.9, alpha: 0.28 },
            { softness: 0.85, stretch: 1.8, angle: Math.PI / 2 },
          );
        }
        d.fillPath(rim, { color: 'rgb(14,14,16)', value: 0.3, alpha: 0.3 });
        d.fillPath(core, { color: 'rgb(98,90,82)', value: 0.18, alpha: 0.8 });
      }

      // Scratches: roughly parallel, like a cloth or tool dragged the same way.
      const dragAngle = d.rng() * Math.PI;
      for (let i = 0; i < Math.round(26 * options.wear); i++) {
        const [x, y] = wornPoint();
        const angle = dragAngle + randomBetween(d.rng, -0.35, 0.35);
        const length = mm(randomBetween(d.rng, 25, 140));
        d.strokePath(
          (c) => { c.moveTo(x, y); c.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length); },
          { color: 'rgb(176,176,172)', value: 0.25, alpha: 0.14 },
          mm(1.2),
        );
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
      // Damp and handling stains.
      for (let i = 0; i < 6; i++) {
        d.stain(
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 0, d.size),
          randomBetween(d.rng, 14, 34),
          { color: 'rgb(54,38,24)', value: 0.8, alpha: 0.22 },
          { softness: 0.7, stretch: randomBetween(d.rng, 1.2, 2), angle: d.rng() * Math.PI },
        );
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
