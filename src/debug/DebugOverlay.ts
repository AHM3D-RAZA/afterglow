import { Vector2, type WebGLRenderer } from 'three';
import './debugOverlay.css';

const REFRESH_INTERVAL_MS = 500;

/**
 * Small development-only readout: FPS and renderer statistics. Toggle with the
 * backtick key.
 *
 * It deliberately knows nothing about the render loop. It polls the renderer's
 * own counters on a timer (`info.render.frame` increments once per render()),
 * so it adds no per-frame work and can be removed without touching the app.
 */
export class DebugOverlay {
  private readonly element: HTMLElement;
  private readonly drawingBufferSize = new Vector2();
  private readonly intervalId: number;
  private lastFrameCount: number;
  private lastTimestamp: number;

  constructor(private readonly renderer: WebGLRenderer) {
    this.element = document.createElement('div');
    this.element.className = 'debug-overlay';
    document.body.appendChild(this.element);

    this.lastFrameCount = renderer.info.render.frame;
    this.lastTimestamp = performance.now();
    this.intervalId = window.setInterval(this.refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  dispose(): void {
    window.clearInterval(this.intervalId);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.element.remove();
  }

  private readonly refresh = (): void => {
    const { info } = this.renderer;
    const now = performance.now();
    const frames = info.render.frame - this.lastFrameCount;
    const seconds = (now - this.lastTimestamp) / 1000;
    this.lastFrameCount = info.render.frame;
    this.lastTimestamp = now;
    if (this.element.hidden || seconds <= 0) return;

    const fps = frames / seconds;
    const frameMs = frames > 0 ? (seconds * 1000) / frames : 0;
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);

    this.element.textContent = [
      `FPS         ${fps.toFixed(1)}  (${frameMs.toFixed(1)} ms)`,
      `Draw calls  ${info.render.calls}  (incl. shadow passes)`,
      `Triangles   ${formatCount(info.render.triangles)}`,
      `Geometries  ${info.memory.geometries}`,
      `Textures    ${info.memory.textures}`,
      `Programs    ${info.programs?.length ?? 0}`,
      `Buffer      ${this.drawingBufferSize.x}×${this.drawingBufferSize.y} @${this.renderer.getPixelRatio()}x`,
      '` toggles this panel',
    ].join('\n');
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Backquote' || event.repeat) return;
    this.element.hidden = !this.element.hidden;
    if (!this.element.hidden) this.refresh();
  };
}

function formatCount(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
