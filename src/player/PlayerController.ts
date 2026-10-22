import { MathUtils, type PerspectiveCamera } from 'three';
import { PLAYER, ROOM } from '../config';
import type { Rect } from '../util/rect';
import { moveWithCollisions, overlapsAny, type FloorPoint } from './collision';
import { PlayerInput, type Axes, type LookDelta, type PointerState } from './input';

/**
 * Walks and looks around: turns input into camera yaw/pitch and a collided floor
 * position. The camera is the player's eye; its height never changes.
 *
 * Yaw 0 faces -Z. Movement uses yaw only, so looking up or down never lifts the
 * player off the floor or pushes them into it.
 */
export class PlayerController {
  private readonly input: PlayerInput;
  private readonly position: FloorPoint = { x: PLAYER.spawn[0], z: PLAYER.spawn[1] };
  private readonly bounds: Rect = {
    minX: -ROOM.halfWidth,
    maxX: ROOM.halfWidth,
    minZ: -ROOM.halfDepth,
    maxZ: ROOM.halfDepth,
  };
  // Reused every frame so update() allocates nothing.
  private readonly axes: Axes = { x: 0, z: 0 };
  private readonly look: LookDelta = { x: 0, y: 0 };
  private yaw = 0;
  private pitch = 0;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly obstacles: readonly Rect[],
    surface: HTMLElement,
    onPointerStateChange: (state: PointerState) => void,
  ) {
    this.input = new PlayerInput(surface, onPointerStateChange);
    // YXZ: yaw about the world's up axis first, then pitch, with no roll.
    camera.rotation.order = 'YXZ';
    this.faceSpawnTarget();
    if (import.meta.env.DEV && overlapsAny({ x: PLAYER.spawn[0], z: PLAYER.spawn[1] }, PLAYER.radius, obstacles)) {
      console.warn('PLAYER.spawn overlaps a solid object.');
    }
    this.applyToCamera();
  }

  get pointerState(): PointerState {
    return this.input.pointerState;
  }

  /** Advances the player by `deltaSeconds` of real time. */
  update(deltaSeconds: number): void {
    this.input.consumeLook(this.look);
    this.yaw -= this.look.x * PLAYER.lookSensitivity;
    this.pitch = MathUtils.clamp(this.pitch - this.look.y * PLAYER.lookSensitivity, -PLAYER.maxPitch, PLAYER.maxPitch);

    this.input.readAxes(this.axes);
    this.walk(Math.min(deltaSeconds, PLAYER.maxFrameSeconds));
    this.applyToCamera();
  }

  dispose(): void {
    this.input.dispose();
  }

  private walk(seconds: number): void {
    const { x: strafe, z: forward } = this.axes;
    const length = Math.hypot(strafe, forward);
    if (length === 0 || seconds <= 0) return;

    // Dividing by the length (not clamping) keeps diagonals at exactly walk speed.
    const distance = (PLAYER.walkSpeed * seconds) / length;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward = (-sin, -cos), right = (cos, -sin) on the (x, z) floor plane.
    moveWithCollisions(
      this.position,
      (strafe * cos - forward * sin) * distance,
      (-strafe * sin - forward * cos) * distance,
      PLAYER.radius,
      this.bounds,
      this.obstacles,
    );
  }

  private faceSpawnTarget(): void {
    const [targetX, targetY, targetZ] = PLAYER.spawnLookAt;
    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = MathUtils.clamp(Math.atan2(targetY - PLAYER.eyeHeight, Math.hypot(dx, dz)), -PLAYER.maxPitch, PLAYER.maxPitch);
  }

  private applyToCamera(): void {
    this.camera.position.set(this.position.x, PLAYER.eyeHeight, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
