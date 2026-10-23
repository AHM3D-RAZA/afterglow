import type { PerspectiveCamera, WebGLRenderer, WebGLRenderTarget } from 'three';
import { PLAYER, RENDERER } from '../config';
import { createEnvironment } from '../scene/environment';
import { createWorkshop, type Workshop } from '../scene/createWorkshop';
import { CleaningSystem } from '../cleaning/CleaningSystem';
import { PlayerController } from '../player/PlayerController';
import { createCameraRig, type CameraRig } from './cameraRig';
import { CleaningHud } from './CleaningHud';
import { ControlsHint } from './ControlsHint';
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
  private readonly player: PlayerController;
  private readonly cleaning: CleaningSystem;
  private readonly controlsHint: ControlsHint;
  private readonly hud: CleaningHud;
  private lastFrameMs: number | null = null;
  private disposed = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = createRenderer(container);
    try {
      this.cameraRig = createCameraRig();
      this.camera = this.cameraRig.camera;
      this.workshop = createWorkshop();
      this.environment = createEnvironment(this.renderer);
      // The callback only runs on user input, after construction has finished.
      this.player = new PlayerController(
        this.camera,
        this.workshop.solidFootprints,
        this.renderer.domElement,
        (state) => this.controlsHint.show(state),
      );
      this.hud = new CleaningHud();
      this.cleaning = new CleaningSystem(
        this.renderer,
        this.camera,
        this.workshop.scene,
        this.workshop.cleanables,
        (_surface, fraction) => this.hud.setCoverage(fraction),
      );
      this.controlsHint = new ControlsHint();
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
    this.lastFrameMs = null;
    this.controlsHint.show(this.player.pointerState);
    window.addEventListener('resize', this.handleResize);
    this.renderer.setAnimationLoop(this.tick);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.cleaning.dispose();
    this.player.dispose();
    this.hud.dispose();
    this.controlsHint.dispose();
    this.workshop.scene.environment = null;
    this.workshop.dispose();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly tick = (timeMs: number): void => {
    try {
      // The first frame, and any frame after the loop was stopped, has no previous time.
      const deltaSeconds = this.lastFrameMs === null ? 0 : (timeMs - this.lastFrameMs) / 1000;
      this.lastFrameMs = timeMs;
      this.player.update(deltaSeconds);
      this.cleaning.update(Math.min(deltaSeconds, PLAYER.maxFrameSeconds), this.player.isPrimaryHeld);
      this.hud.setAiming(this.player.pointerState === 'locked');
      this.workshop.update(timeMs / 1000);
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
