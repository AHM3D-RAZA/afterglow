import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import { clamp01, domainWarp, fbm, resample, smoothstep } from './noise';
import { createRng, type Rng } from './random';
import { createStainShape, drawStain, type StainOptions } from './stains';

/** sRGB color, each channel 0–255. */
export type Rgb = readonly [number, number, number];

/**
 * Describes one weathered surface. The generator layers large-scale color
 * drift, grime and fine grain into an albedo map, plus a grayscale "detail"
 * map that doubles as roughness and bump data (one canvas instead of two).
 * `details` then paints surface-specific vector features (joints, planks, chips).
 */
export interface SurfaceRecipe {
  seed: number;
  /** Texture resolution in pixels (square). */
  resolution: number;
  /** Physical size, in meters, covered by one texture repeat. */
  tileMeters: number;
  baseColor: Rgb;
  /** Color the base drifts toward where the large-scale noise is high. */
  mottleColor: Rgb;
  grimeColor: Rgb;
  /** Roughly the fraction of the surface darkened by grime, 0–1. */
  grimeCoverage: number;
  /** Strength of fine speckle in brightness, 0–1. */
  grain: number;
  /** Roughness range written into the detail map (multiply by material.roughness = 1). */
  roughness: readonly [number, number];
  /** Lattice cells for the large-scale color drift; stretch one axis for wood grain. */
  mottleCells?: readonly [number, number];
  /**
   * Lattice cells (x, y) of the broad grime layer. Unequal values stretch the
   * features: fewer cells along y gives tall, drip-like discoloration. Default [3, 3].
   */
  grimeCells?: readonly [number, number];
  /**
   * Where dirt tends to gather, as an offset added to the grime noise before it
   * is thresholded (so the edge of the dirt stays irregular instead of becoming
   * a gradient). `u` runs left to right across the tile; `v` runs bottom to top
   * (up on walls, away from the viewer on the floor). Typical range −0.2 … 0.4.
   */
  grimeBias?: (u: number, v: number) => number;
  details?: (context: SurfaceDetailContext) => void;
}

export interface SurfacePaint {
  /** CSS color painted onto the albedo map. */
  color: string;
  /** Grayscale value (0–1) painted onto the detail map: higher = rougher / taller. */
  value: number;
  alpha?: number;
}

/** Paints the same shape onto both maps so features stay registered. */
export interface SurfaceDetailContext {
  /** Texture resolution in pixels. */
  readonly size: number;
  readonly pixelsPerMeter: number;
  readonly rng: Rng;
  strokePath(draw: (ctx: CanvasRenderingContext2D) => void, paint: SurfacePaint, lineWidth: number): void;
  fillPath(draw: (ctx: CanvasRenderingContext2D) => void, paint: SurfacePaint): void;
  /**
   * Irregular, noise-edged stain centered on (x, y). Wraps around the tile edges.
   * `radius` is in pixels; see StainOptions for shaping it.
   */
  stain(x: number, y: number, radius: number, paint: SurfacePaint, options?: StainOptions): void;
  /** Tileable fractal noise covering the whole texture, values 0–1. Use it to cluster features. */
  noiseField(cells: number, octaves?: number): Float32Array;
}

export interface SurfaceTextures {
  map: CanvasTexture;
  /** Used for both `roughnessMap` and `bumpMap`. */
  detailMap: CanvasTexture;
}

export function createSurfaceTextures(recipe: SurfaceRecipe): SurfaceTextures {
  const { resolution } = recipe;
  const rng = createRng(recipe.seed);

  const colorCanvas = createCanvas(resolution);
  const detailCanvas = createCanvas(resolution);
  paintBaseLayers(recipe, rng, colorCanvas, detailCanvas);

  if (recipe.details) {
    recipe.details(createDetailContext(recipe, rng, colorCanvas, detailCanvas));
  }

  return {
    map: finishTexture(colorCanvas, recipe.tileMeters, SRGBColorSpace),
    detailMap: finishTexture(detailCanvas, recipe.tileMeters, NoColorSpace),
  };
}

/** Half-width of the grime threshold; larger = softer-edged dirt. */
const GRIME_FEATHER = 0.2;

/** Stains fainter than this are painted on the albedo map only. */
const FAINT_STAIN_ALPHA = 0.08;

/**
 * Broad discoloration plus finer irregular variation. Both layers are domain
 * warped, so no single lattice scale or round "island" shape dominates.
 *
 * Grime is smooth, so it is generated at reduced resolution (a quarter for
 * 1024 px textures, half otherwise) and resampled, with no visible difference.
 */
function createGrimeField(recipe: SurfaceRecipe, rng: Rng): Float32Array {
  const size = recipe.resolution;
  // Large textures can afford a coarser grid: the finest grime layer is still >= 4 px per cell.
  const workSize = size >= 1024 ? size / 4 : size / 2;
  const [cellsX, cellsY] = recipe.grimeCells ?? [3, 3];

  const broad = domainWarp(
    fbm({ width: workSize, height: workSize, cellsX, cellsY, octaves: 4 }, rng),
    workSize,
    0.1,
    rng,
  );
  const fine = domainWarp(
    fbm({ width: workSize, height: workSize, cellsX: cellsX * 5, cellsY: cellsY * 5, octaves: 3, persistence: 0.55 }, rng),
    workSize,
    0.04,
    rng,
  );

  // The bias is evaluated on this coarse grid too; it is a broad tendency, not pixel detail.
  const bias = recipe.grimeBias;
  const combined = new Float32Array(workSize * workSize);
  for (let i = 0; i < combined.length; i++) {
    const u = (i % workSize) / workSize;
    const v = 1 - Math.floor(i / workSize) / workSize;
    combined[i] = 0.68 * broad[i] + 0.32 * fine[i] + (bias ? bias(u, v) : 0);
  }
  return resample(combined, workSize, size);
}

function paintBaseLayers(
  recipe: SurfaceRecipe,
  rng: Rng,
  colorCanvas: HTMLCanvasElement,
  detailCanvas: HTMLCanvasElement,
): void {
  const { resolution: size } = recipe;
  const [mottleX, mottleY] = recipe.mottleCells ?? [5, 5];
  const grainCells = Math.max(2, size / 8);

  const mottle = fbm({ width: size, height: size, cellsX: mottleX, cellsY: mottleY, octaves: 5 }, rng);
  const grime = createGrimeField(recipe, rng);
  const grain = fbm(
    { width: size, height: size, cellsX: grainCells, cellsY: grainCells, octaves: 2, persistence: 0.6 },
    rng,
  );

  const colorContext = getContext(colorCanvas);
  const detailContext = getContext(detailCanvas);
  const colorImage = colorContext.createImageData(size, size);
  const detailImage = detailContext.createImageData(size, size);
  const [roughMin, roughMax] = recipe.roughness;
  const grimeEdge = 1 - recipe.grimeCoverage;

  for (let i = 0; i < size * size; i++) {
    const m = mottle[i];
    const g = smoothstep(grimeEdge - GRIME_FEATHER, grimeEdge + GRIME_FEATHER, grime[i]);
    const n = grain[i];
    const brightness = 1 + (n - 0.5) * recipe.grain;

    const p = i * 4;
    for (let channel = 0; channel < 3; channel++) {
      let value = recipe.baseColor[channel] + (recipe.mottleColor[channel] - recipe.baseColor[channel]) * m;
      value += (recipe.grimeColor[channel] - value) * g * 0.55;
      colorImage.data[p + channel] = value * brightness;
      detailImage.data[p + channel] = (roughMin + (roughMax - roughMin) * clamp01(0.45 * n + 0.2 * m + 0.45 * g)) * 255;
    }
    colorImage.data[p + 3] = 255;
    detailImage.data[p + 3] = 255;
  }

  colorContext.putImageData(colorImage, 0, 0);
  detailContext.putImageData(detailImage, 0, 0);
}

function createDetailContext(
  recipe: SurfaceRecipe,
  rng: Rng,
  colorCanvas: HTMLCanvasElement,
  detailCanvas: HTMLCanvasElement,
): SurfaceDetailContext {
  const colorContext = getContext(colorCanvas);
  const detailContext = getContext(detailCanvas);
  const targets = [
    { ctx: colorContext, style: (paint: SurfacePaint) => paint.color },
    { ctx: detailContext, style: (paint: SurfacePaint) => grayStyle(paint.value) },
  ] as const;

  /** Runs `paintOne` once per target canvas with state saved and alpha applied. */
  const forEachTarget = (
    paint: SurfacePaint,
    paintOne: (ctx: CanvasRenderingContext2D, style: string) => void,
  ): void => {
    for (const { ctx, style } of targets) {
      ctx.save();
      ctx.globalAlpha = paint.alpha ?? 1;
      paintOne(ctx, style(paint));
      ctx.restore();
    }
  };

  return {
    size: recipe.resolution,
    pixelsPerMeter: recipe.resolution / recipe.tileMeters,
    rng,

    strokePath(draw, paint, lineWidth) {
      forEachTarget(paint, (ctx, style) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        draw(ctx);
        ctx.stroke();
      });
    },

    fillPath(draw, paint) {
      forEachTarget(paint, (ctx, style) => {
        ctx.fillStyle = style;
        ctx.beginPath();
        draw(ctx);
        ctx.fill();
      });
    },

    stain(x, y, radius, paint, options = {}) {
      // The shape is built once, outside forEachTarget, so both maps get the
      // identical stain and `rng` is consumed exactly once.
      const shape = createStainShape(radius, options, rng);
      // A very faint stain changes the albedo but not the roughness or bump
      // measurably, so the detail map skips it (it is a large share of the drawing cost).
      const faint = (paint.alpha ?? 1) < FAINT_STAIN_ALPHA;
      forEachTarget(paint, (ctx, style) => {
        if (faint && ctx === detailContext) return;
        drawStain(ctx, shape, style, x, y, recipe.resolution);
      });
    },

    noiseField(cells, octaves = 3) {
      return fbm(
        { width: recipe.resolution, height: recipe.resolution, cellsX: cells, cellsY: cells, octaves },
        rng,
      );
    },
  };
}

function grayStyle(value: number): string {
  const level = Math.round(clamp01(value) * 255);
  return `rgb(${level},${level},${level})`;
}

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create a 2D canvas context for procedural textures.');
  return context;
}

function finishTexture(
  canvas: HTMLCanvasElement,
  tileMeters: number,
  colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // UVs are in meters (see util/geometry.ts), so one repeat covers `tileMeters`.
  texture.repeat.set(1 / tileMeters, 1 / tileMeters);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  return texture;
}
