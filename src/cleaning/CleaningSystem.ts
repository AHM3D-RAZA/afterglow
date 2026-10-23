import { MathUtils, Raycaster, Vector2, Vector3, type Intersection, type Object3D, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import type { CleanableSurface } from '../scene/dirtLayer';
import { CoverageMeter } from './CoverageMeter';
import { DirtMask } from './DirtMask';
import { SprayEffect, type SprayState } from './SprayEffect';

/** Farthest the spray reaches, in meters. */
const MAX_RANGE = 3.5;
/** Nozzle position relative to the camera: low and to the right, like a held wand. */
const NOZZLE_OFFSET = [0.16, -0.17, -0.3] as const;
/** Cleaning added per second at the center of the brush. A thin patch needs well under a second. */
const CLEAN_RATE = 5;
/** Brush radius grows with distance, as a real spray fans out. Meters. */
const MIN_BRUSH_RADIUS = 0.05;
const BRUSH_RADIUS_PER_METER = 0.025;
const MAX_BRUSH_RADIUS = 0.14;
/** Stamps along a moved path are spaced at this fraction of the radius, so strokes stay continuous. */
const STAMP_SPACING = 0.5;
const MAX_STAMPS_PER_PATH = 10;

interface CleanableEntry {
  readonly surface: CleanableSurface;
  readonly mask: DirtMask;
  readonly meter: CoverageMeter;
  /** Where the previous frame's spray landed, so a fast stroke can be filled in. */
  readonly lastUv: Vector2;
  hasLastUv: boolean;
  /** The mask changed since the last coverage measurement started. */
  measurePending: boolean;
}

/**
 * Ties the spray together each frame: aim ray, brush stamps on the surface
 * that was hit, and water feedback. Anything that is not a registered
 * cleanable surface only gets the water feedback.
 */
export class CleaningSystem {
  private readonly raycaster = new Raycaster();
  private readonly effect: SprayEffect;
  private readonly entries = new Map<Object3D, CleanableEntry>();
  private readonly state: SprayState = {
    spraying: false,
    origin: new Vector3(),
    target: new Vector3(),
    hit: false,
    normal: new Vector3(0, 1, 0),
  };
  private readonly direction = new Vector3();
  private readonly pathUv = new Vector2();
  private readonly bufferSize = new Vector2();
  private wasSpraying = false;

  /** @param onCoverage Called with a surface name and its cleaned fraction (0..1) whenever it is re-measured. */
  constructor(
    renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    private readonly scene: Scene,
    surfaces: readonly CleanableSurface[],
    onCoverage: (surfaceName: string, fraction: number) => void,
  ) {
    this.raycaster.far = MAX_RANGE;
    this.effect = new SprayEffect(scene, camera, () => renderer.getDrawingBufferSize(this.bufferSize).y);
    for (const surface of surfaces) {
      const mask = new DirtMask(renderer, surface);
      const meter = new CoverageMeter(renderer, surface, mask, (fraction) => onCoverage(surface.name, fraction));
      this.entries.set(surface.mesh, { surface, mask, meter, lastUv: new Vector2(), hasLastUv: false, measurePending: false });
      meter.measure(performance.now(), true); // initial reading
    }
  }

  /** Advances the spray by `deltaSeconds`. Call once per frame, before the main render. */
  update(deltaSeconds: number, spraying: boolean): void {
    const now = performance.now();
    if (spraying) this.spray(deltaSeconds);
    else this.releaseSpray();

    this.state.spraying = spraying;
    this.effect.update(deltaSeconds, this.state);

    for (const entry of this.entries.values()) {
      entry.mask.flush();
      if (entry.measurePending && entry.meter.measure(now, !spraying)) entry.measurePending = false;
    }
    this.wasSpraying = spraying;
  }

  dispose(): void {
    this.effect.dispose();
    for (const entry of this.entries.values()) {
      entry.meter.dispose();
      entry.mask.dispose();
    }
    this.entries.clear();
  }

  private spray(deltaSeconds: number): void {
    const { camera, state, direction } = this;
    camera.updateMatrixWorld();
    camera.getWorldDirection(direction);
    state.origin.set(...NOZZLE_OFFSET);
    camera.localToWorld(state.origin);

    this.raycaster.set(camera.position, direction);
    const hit = this.raycaster.intersectObject(this.scene, true)[0] as Intersection | undefined;

    state.hit = hit !== undefined;
    if (hit) {
      state.target.copy(hit.point);
      if (hit.face) state.normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    } else {
      state.target.copy(camera.position).addScaledVector(direction, MAX_RANGE);
    }

    const entry = hit ? this.entries.get(hit.object) : undefined;
    for (const other of this.entries.values()) if (other !== entry) other.hasLastUv = false;
    if (hit && entry && hit.uv) this.clean(entry, hit.uv, hit.distance, deltaSeconds);
  }

  private releaseSpray(): void {
    if (this.wasSpraying) this.effect.stopStream();
    this.state.hit = false;
    for (const entry of this.entries.values()) entry.hasLastUv = false;
  }

  /** Stamps the brush at `uv`, filling in the path from the previous frame so fast strokes stay continuous. */
  private clean(entry: CleanableEntry, uv: Vector2, distance: number, deltaSeconds: number): void {
    const radius = MathUtils.clamp(MIN_BRUSH_RADIUS + BRUSH_RADIUS_PER_METER * distance, MIN_BRUSH_RADIUS, MAX_BRUSH_RADIUS);
    const [width, height] = entry.surface.sizeMeters;

    let stamps = 1;
    if (entry.hasLastUv) {
      const pathMeters = Math.hypot((uv.x - entry.lastUv.x) * width, (uv.y - entry.lastUv.y) * height);
      stamps = MathUtils.clamp(Math.ceil(pathMeters / (radius * STAMP_SPACING)), 1, MAX_STAMPS_PER_PATH);
    }
    // The frame's cleaning is shared among the stamps, so stroke speed does not change the total.
    const amount = (CLEAN_RATE * deltaSeconds) / stamps;
    for (let i = 1; i <= stamps; i++) {
      const t = i / stamps;
      const along = entry.hasLastUv ? this.pathUv.copy(entry.lastUv).lerp(uv, t) : uv;
      entry.mask.addStamp(along.x, along.y, radius, amount);
    }
    entry.lastUv.copy(uv);
    entry.hasLastUv = true;
    entry.measurePending = true;
  }
}
