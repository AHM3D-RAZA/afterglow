import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import { clamp01, fbm, smoothstep } from './noise';
import { createRng, type Rng } from './random';

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
  /** Soft round stain that fades to transparent at its edge. */
  blob(x: number, y: number, radius: number, paint: SurfacePaint): void;
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
  const grime = fbm({ width: size, height: size, cellsX: 2, cellsY: 2, octaves: 4 }, rng);
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
    const g = smoothstep(grimeEdge - 0.3, grimeEdge + 0.3, grime[i]);
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

    blob(x, y, radius, paint) {
      forEachTarget(paint, (ctx, style) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, style);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      });
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
