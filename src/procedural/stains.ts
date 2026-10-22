import { fbm, smoothstep } from './noise';
import type { Rng } from './random';

export interface StainOptions {
  /** 0 = crisp outline, 1 = fully feathered. Default 0.7. */
  softness?: number;
  /** Elongation along `angle`; 1 is roughly round before the outline noise. Default 1. */
  stretch?: number;
  /** Direction of elongation in radians in canvas space (0 = along +x, π/2 = down). Default 0. */
  angle?: number;
}

/**
 * Alpha mask of one stain, built in the stain's own axes (`length` along its
 * direction of elongation, `thickness` across it) and rotated into place when
 * drawn. A long thin drip therefore costs a thin strip, not a big square.
 */
export interface StainShape {
  /** Extent on the texture along the stain's axis, in texture pixels. */
  readonly length: number;
  /** Extent on the texture across the stain's axis, in texture pixels. */
  readonly thickness: number;
  readonly angle: number;
  /** Mask size in pixels; capped, then scaled up to the extents above when drawn. */
  readonly columns: number;
  readonly rows: number;
  /** `columns` × `rows` alpha values, 0–1. */
  readonly alpha: Float32Array;
}

/**
 * Stains are soft and irregular, so a coarse mask upscaled when drawn looks the
 * same as a full-resolution one. This caps the longest side of the mask.
 */
const MAX_MASK_RESOLUTION = 64;

/** How far noise may push the outline in or out, as a fraction of the radius. */
const OUTLINE_RAGGEDNESS = 0.9;

/**
 * Builds an irregular stain shape. A perfect radial falloff reads as a round
 * smudge, so the outline and the opacity inside are both driven by noise:
 * the edge wanders, and the interior is mottled instead of evenly filled.
 * Consumes the same amount of `rng` regardless of where the stain is drawn.
 */
export function createStainShape(radius: number, options: StainOptions, rng: Rng): StainShape {
  const { softness = 0.7, stretch = 1, angle = 0 } = options;
  const lengthRadius = radius * Math.max(1, stretch);
  // 1.5: the outline noise can push the edge ~45% past the nominal radius.
  const length = Math.ceil(lengthRadius * 1.5 * 2);
  const thickness = Math.ceil(radius * 1.5 * 2);

  const reduce = Math.min(1, MAX_MASK_RESOLUTION / length);
  const columns = Math.max(4, Math.ceil(length * reduce));
  const rows = Math.max(4, Math.ceil(thickness * reduce));
  const noise = fbm({ width: columns, height: rows, cellsX: 3, cellsY: 3, octaves: 2 }, rng);

  const feather = Math.max(softness, 0.05);
  const alpha = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    const across = ((row + 0.5) / rows - 0.5) * thickness;
    for (let column = 0; column < columns; column++) {
      const along = (((column + 0.5) / columns - 0.5) * length) / stretch;
      const distance = Math.sqrt(along * along + across * across) / radius;
      const n = noise[row * columns + column];
      const inside = 1 - distance + (n - 0.5) * OUTLINE_RAGGEDNESS;
      alpha[row * columns + column] = smoothstep(0, feather, inside) * (0.55 + 0.45 * n);
    }
  }
  return { length, thickness, angle, columns, rows, alpha };
}

/**
 * Paints a stain centered on (x, y) with the given CSS color. Copies are drawn
 * wrapped around the canvas edges so the texture still tiles without a seam.
 * The caller sets `ctx.globalAlpha`.
 */
export function drawStain(
  ctx: CanvasRenderingContext2D,
  shape: StainShape,
  style: string,
  x: number,
  y: number,
  canvasSize: number,
): void {
  const tinted = tintMask(shape, style);
  // A circle around the rotated mask: a copy is needed wherever it reaches the canvas.
  const boundingRadius = Math.hypot(shape.length, shape.thickness) / 2;

  for (const offsetX of [-canvasSize, 0, canvasSize]) {
    for (const offsetY of [-canvasSize, 0, canvasSize]) {
      const centerX = x + offsetX;
      const centerY = y + offsetY;
      const reaches =
        centerX + boundingRadius > 0 &&
        centerX - boundingRadius < canvasSize &&
        centerY + boundingRadius > 0 &&
        centerY - boundingRadius < canvasSize;
      if (!reaches) continue;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(shape.angle);
      ctx.drawImage(tinted, -shape.length / 2, -shape.thickness / 2, shape.length, shape.thickness);
      ctx.restore();
    }
  }
}

/**
 * One scratch canvas reused for every stain: creating a canvas per stain per
 * map was a measurable share of texture generation time. Safe to share because
 * `drawStain` finishes with the tinted result before the next stain starts.
 */
let scratchCanvas: HTMLCanvasElement | null = null;

/** Fills the mask's opaque area with `style`, leaving the scratch canvas ready to draw. */
function tintMask(shape: StainShape, style: string): HTMLCanvasElement {
  const canvas = (scratchCanvas ??= document.createElement('canvas'));
  canvas.width = shape.columns; // resizing also clears the canvas
  canvas.height = shape.rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context for a stain.');

  const image = ctx.createImageData(shape.columns, shape.rows);
  for (let i = 0; i < shape.alpha.length; i++) image.data[i * 4 + 3] = shape.alpha[i] * 255;
  ctx.putImageData(image, 0, 0);

  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, shape.columns, shape.rows);
  return canvas;
}
