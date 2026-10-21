import type { PerspectiveCamera, WebGLRenderer, WebGLRenderTarget } from 'three';
import { RENDERER } from '../config';
import { createEnvironment } from '../scene/environment';
import { createWorkshop, type Workshop } from '../scene/createWorkshop';
import { createCameraRig, type CameraRig } from './cameraRig';
import { createRenderer } from './createRenderer';

/**
 * Owns the renderer, camera and workshop, and runs the frame loop.
 * Everything it creates is released by `dispose()`.
 */
export class App {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;

  private readonly cameraRig: CameraRig;
  private readonly workshop: Workshop;
  private readonly environment: WebGLRenderTarget;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = createRenderer(container);
    try {
      this.cameraRig = createCameraRig();
      this.camera = this.cameraRig.camera;
      this.workshop = createWorkshop();
      this.environment = createEnvironment(this.renderer);
    } catch (error) {
      // Don't leave a dead canvas and GL context behind if scene construction fails.
      this.renderer.dispose();
      this.renderer.domElement.remove();
      throw error;
    }

    this.workshop.scene.environment = this.environment.texture;
    this.workshop.scene.environmentIntensity = RENDERER.environmentIntensity;
    this.handleResize();
  }

  start(): void {
    window.addEventListener('resize', this.handleResize);
    this.renderer.setAnimationLoop(this.tick);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.workshop.scene.environment = null;
    this.workshop.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly tick = (timeMs: number): void => {
    try {
      const elapsedSeconds = timeMs / 1000;
      this.workshop.update(elapsedSeconds);
      this.cameraRig.update(elapsedSeconds);
      this.renderer.render(this.workshop.scene, this.camera);
    } catch (error) {
      // Stop instead of throwing the same error 60 times a second; the caller still sees it.
      this.renderer.setAnimationLoop(null);
      throw error;
    }
  };

  /** Matches the drawing buffer and camera to the container. Also covers zoom (DPR) changes. */
  private readonly handleResize = (): void => {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERER.maxPixelRatio));
    // `false`: leave canvas CSS size to the stylesheet; only the drawing buffer changes.
    this.renderer.setSize(width, height, false);
    this.cameraRig.setViewport(width, height);
  };
}
