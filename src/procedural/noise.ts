import type { Rng } from './random';

export interface FbmOptions {
  width: number;
  height: number;
  /** Lattice cells across the texture for the first (coarsest) octave. */
  cellsX: number;
  cellsY: number;
  octaves: number;
  /** Amplitude multiplier per octave. Lower = smoother. */
  persistence?: number;
}

/**
 * Tileable fractal value noise, normalized to [0, 1].
 * Each octave doubles the lattice resolution; the lattice wraps, so the
 * result tiles seamlessly when used as a repeating texture.
 */
export function fbm(options: FbmOptions, rng: Rng): Float32Array {
  const { width, height, octaves, persistence = 0.5 } = options;
  const out = new Float32Array(width * height);

  let amplitude = 1;
  for (let octave = 0; octave < octaves; octave++) {
    const cellsX = Math.max(1, Math.round(options.cellsX * 2 ** octave));
    const cellsY = Math.max(1, Math.round(options.cellsY * 2 ** octave));
    const lattice = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rng();

    // Per-column sampling info is identical for every row, so compute it once.
    const columnA = new Int32Array(width);
    const columnB = new Int32Array(width);
    const columnT = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const gx = (x / width) * cellsX;
      const cell = Math.floor(gx);
      const t = gx - cell;
      columnA[x] = cell % cellsX;
      columnB[x] = (cell + 1) % cellsX;
      columnT[x] = fade(t);
    }

    for (let y = 0; y < height; y++) {
      const gy = (y / height) * cellsY;
      const cell = Math.floor(gy);
      const ty = gy - cell;
      const smoothY = fade(ty);
      const rowA = (cell % cellsY) * cellsX;
      const rowB = ((cell + 1) % cellsY) * cellsX;

      for (let x = 0; x < width; x++) {
        const a = columnA[x];
        const b = columnB[x];
        const tx = columnT[x];
        const top = lattice[rowA + a] + (lattice[rowA + b] - lattice[rowA + a]) * tx;
        const bottom = lattice[rowB + a] + (lattice[rowB + b] - lattice[rowB + a]) * tx;
        out[y * width + x] += amplitude * (top + (bottom - top) * smoothY);
      }
    }
    amplitude *= persistence;
  }

  return normalize(out);
}

/** Stretches values to span exactly [0, 1] so recipes can rely on the full range. */
function normalize(values: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < values.length; i++) {
    values[i] = (values[i] - min) / range;
  }
  return values;
}

/**
 * Quintic fade curve. Unlike smoothstep it has zero first AND second
 * derivative at cell borders, which hides the square lattice in value noise.
 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Bends a square, tileable field by sampling it at positions displaced with
 * low-frequency noise (domain warping). Straight lattice structure turns into
 * the meandering, irregular shapes real grime has. `strength` is the maximum
 * displacement as a fraction of the texture size (0.1 is a strong bend).
 *
 * The displacement is generated at quarter resolution: it is smooth by
 * construction, so this costs a fraction of a full-resolution noise pass.
 */
export function domainWarp(field: Float32Array, size: number, strength: number, rng: Rng): Float32Array {
  const warpSize = Math.max(16, size >> 2);
  const options = { width: warpSize, height: warpSize, cellsX: 3, cellsY: 3, octaves: 3 };
  const warpX = fbm(options, rng);
  const warpY = fbm(options, rng);

  const out = new Float32Array(field.length);
  const reduce = warpSize / size;
  const maxShift = strength * size * 2;
  for (let y = 0; y < size; y++) {
    const warpRow = Math.floor(y * reduce) * warpSize;
    for (let x = 0; x < size; x++) {
      const w = warpRow + Math.floor(x * reduce);
      out[y * size + x] = sampleWrapped(
        field,
        size,
        x + (warpX[w] - 0.5) * maxShift,
        y + (warpY[w] - 0.5) * maxShift,
      );
    }
  }
  return out;
}

/** Resizes a square tileable field (both sizes powers of two) with bilinear filtering. */
export function resample(field: Float32Array, fromSize: number, toSize: number): Float32Array {
  const out = new Float32Array(toSize * toSize);
  const ratio = fromSize / toSize;
  for (let y = 0; y < toSize; y++) {
    for (let x = 0; x < toSize; x++) {
      out[y * toSize + x] = sampleWrapped(field, fromSize, (x + 0.5) * ratio - 0.5, (y + 0.5) * ratio - 0.5);
    }
  }
  return out;
}

/**
 * Bilinear lookup in a square tileable field; coordinates wrap around.
 * `size` must be a power of two: wrapping uses a bit mask, which is much
 * cheaper than `%` in this hot loop and also handles negative coordinates.
 */
function sampleWrapped(field: Float32Array, size: number, x: number, y: number): number {
  const mask = size - 1;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const left = x0 & mask;
  const top = y0 & mask;
  const right = (left + 1) & mask;
  const bottom = (top + 1) & mask;
  const upper = field[top * size + left] + (field[top * size + right] - field[top * size + left]) * fx;
  const lower = field[bottom * size + left] + (field[bottom * size + right] - field[bottom * size + left]) * fx;
  return upper + (lower - upper) * fy;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
