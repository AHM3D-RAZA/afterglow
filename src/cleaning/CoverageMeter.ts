import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { DIRT_GLSL, type CleanableSurface } from '../scene/dirtLayer';
import { renderOffscreen, type DirtMask } from './DirtMask';

/** The surface is measured on a GRID x GRID lattice of cells. */
const GRID = 64;
/** Samples per cell side, so each cell averages SUBSAMPLES² points of the mask. */
const SUBSAMPLES = 4;
/** Shortest time between measurements. */
const MIN_INTERVAL_MS = 250;

/**
 * How much of the original dirt has been removed, measured from the mask.
 *
 * A small shader evaluates, on a coarse grid, how much dirt was visible at the
 * start and how much is visible now (using the same function as the material),
 * into a 64x64 target. Only that 16 KB target is read back, asynchronously and
 * at most four times a second, so the full-resolution mask is never read and
 * the frame never waits on the GPU.
 */
export class CoverageMeter {
  private readonly target = new WebGLRenderTarget(GRID, GRID, { depthBuffer: false });
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly material: ShaderMaterial;
  private readonly pixels = new Uint8Array(GRID * GRID * 4);
  private lastMeasureMs = -Infinity;
  private reading = false;
  private disposed = false;
  private latest = 0;

  /** @param onChange Called with the new cleaned fraction (0..1) after each measurement. */
  constructor(
    private readonly renderer: WebGLRenderer,
    surface: CleanableSurface,
    mask: DirtMask,
    private readonly onChange: (fraction: number) => void,
  ) {
    this.material = new ShaderMaterial({
      uniforms: {
        uCleanMask: { value: mask.target.texture },
        uCleanSize: { value: [surface.sizeMeters[0], surface.sizeMeters[1]] },
      },
      vertexShader: /* glsl */ `
        void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uCleanMask;
        uniform vec2 uCleanSize;
        ${DIRT_GLSL}
        void main() {
          float before = 0.0;
          float now = 0.0;
          for ( int y = 0; y < ${SUBSAMPLES}; y++ ) {
            for ( int x = 0; x < ${SUBSAMPLES}; x++ ) {
              vec2 offset = ( vec2( float( x ), float( y ) ) + 0.5 ) / ${SUBSAMPLES.toFixed(1)};
              vec2 uv = ( floor( gl_FragCoord.xy ) + offset ) / ${GRID.toFixed(1)};
              float thickness = dirtThickness( uv, uCleanSize );
              before += dirtVisibility( thickness, 0.0 );
              now += dirtVisibility( thickness, texture2D( uCleanMask, uv ).r );
            }
          }
          float count = ${(SUBSAMPLES * SUBSAMPLES).toFixed(1)};
          gl_FragColor = vec4( before / count, now / count, 0.0, 1.0 );
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(this.geometry, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** Starts a measurement if enough time has passed and none is in flight. Returns whether one started. */
  measure(nowMs: number, force = false): boolean {
    if (this.reading || this.disposed) return false;
    if (!force && nowMs - this.lastMeasureMs < MIN_INTERVAL_MS) return false;
    this.lastMeasureMs = nowMs;
    this.reading = true;

    renderOffscreen(this.renderer, this.target, this.scene, this.camera);
    this.renderer
      .readRenderTargetPixelsAsync(this.target, 0, 0, GRID, GRID, this.pixels)
      .then(() => this.finishRead())
      .catch((error: unknown) => {
        // A lost context or a disposed renderer is not worth an error cascade.
        if (!this.disposed) console.warn('Coverage measurement failed.', error);
      })
      .finally(() => {
        this.reading = false;
      });
    return true;
  }

  get fraction(): number {
    return this.latest;
  }

  dispose(): void {
    this.disposed = true;
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private finishRead(): void {
    if (this.disposed) return;
    let before = 0;
    let now = 0;
    for (let i = 0; i < this.pixels.length; i += 4) {
      before += this.pixels[i];
      now += this.pixels[i + 1];
    }
    this.latest = before > 0 ? Math.min(1, Math.max(0, 1 - now / before)) : 0;
    this.onChange(this.latest);
  }
}
