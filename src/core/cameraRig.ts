import { MathUtils, PerspectiveCamera } from 'three';
import { CAMERA } from '../config';

/**
 * The player's eye. It owns the camera and keeps its projection right for the
 * viewport; where it stands and where it looks is the PlayerController's job.
 */
export interface CameraRig {
  readonly camera: PerspectiveCamera;
  /** Updates aspect ratio and field of view for the given viewport size (CSS pixels). */
  setViewport(width: number, height: number): void;
}

export function createCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);

  return {
    camera,

    setViewport(width, height) {
      camera.aspect = width / height;
      camera.fov = verticalFovForAspect(camera.aspect);
      camera.updateProjectionMatrix();
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
