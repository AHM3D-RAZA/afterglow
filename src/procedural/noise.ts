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
      columnT[x] = t * t * (3 - 2 * t);
    }

    for (let y = 0; y < height; y++) {
      const gy = (y / height) * cellsY;
      const cell = Math.floor(gy);
      const ty = gy - cell;
      const smoothY = ty * ty * (3 - 2 * ty);
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

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
