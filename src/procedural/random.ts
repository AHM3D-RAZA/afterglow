/** A function returning a pseudo-random number in [0, 1). */
export type Rng = () => number;

/**
 * Small deterministic PRNG (mulberry32). Procedural textures must look the
 * same on every load, so nothing in `procedural/` uses Math.random().
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
