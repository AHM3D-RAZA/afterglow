import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA } from '../config';

/**
 * A fixed, composed camera with an optional barely-there sway.
 * This is a viewing camera, not player controls: nothing here reads input.
 */
export interface CameraRig {
  readonly camera: PerspectiveCamera;
  /** Updates aspect ratio and field of view for the given viewport size (CSS pixels). */
  setViewport(width: number, height: number): void;
  update(elapsedSeconds: number): void;
}

export function createCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  const basePosition = new Vector3(...CAMERA.position);
  const lookAtTarget = new Vector3(...CAMERA.lookAt);
  const driftEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  camera.position.copy(basePosition);
  camera.lookAt(lookAtTarget);

  return {
    camera,

    setViewport(width, height) {
      camera.aspect = width / height;
      camera.fov = verticalFovForAspect(camera.aspect);
      camera.updateProjectionMatrix();
    },

    update(elapsedSeconds) {
      if (!driftEnabled) return;
      const phase = (elapsedSeconds / CAMERA.drift.periodSeconds) * Math.PI * 2;
      camera.position.set(
        basePosition.x + Math.sin(phase) * CAMERA.drift.amplitude,
        basePosition.y + Math.sin(phase * 1.7 + 1.3) * CAMERA.drift.amplitude * 0.5,
        basePosition.z,
      );
      camera.lookAt(lookAtTarget);
    },
  };
}

/**
 * Keeps the framing readable in narrow windows: widen the vertical FOV so the
 * horizontal FOV never falls below CAMERA.minHorizontalFov (up to a sane cap).
 */
function verticalFovForAspect(aspect: number): number {
  const minHorizontal = MathUtils.degToRad(CAMERA.minHorizontalFov);
  const verticalForMinHorizontal = MathUtils.radToDeg(
    2 * Math.atan(Math.tan(minHorizontal / 2) / aspect),
  );
  return Math.min(CAMERA.maxVerticalFov, Math.max(CAMERA.fov, verticalForMinHorizontal));
}
