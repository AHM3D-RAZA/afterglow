/** Where mouse capture stands. `failed` means the browser refused the last request. */
export type PointerState = 'unlocked' | 'locked' | 'failed';

export interface Axes {
  /** Strafe: +1 is right. */
  x: number;
  /** Walk: +1 is forward. */
  z: number;
}

export interface LookDelta {
  /** Pixels moved since the last read; +x is right, +y is down. */
  x: number;
  y: number;
}

/**
 * Some browsers occasionally report a huge bogus mouse delta right after
 * pointer lock is acquired. A real flick is far below this per event.
 */
const MAX_DELTA_PER_EVENT = 300;

/**
 * Mouse movement is ignored briefly after the lock is acquired: browsers can
 * deliver a stale, cursor-jump sized delta right then, which would snap the view.
 */
const LOCK_SETTLE_MS = 150;

const KEY_FORWARD = 'KeyW';
const KEY_BACK = 'KeyS';
const KEY_LEFT = 'KeyA';
const KEY_RIGHT = 'KeyD';
const MOVEMENT_KEYS: ReadonlySet<string> = new Set([KEY_FORWARD, KEY_BACK, KEY_LEFT, KEY_RIGHT]);

/**
 * Collects raw input: held movement keys, accumulated mouse movement and the
 * pointer-lock state. It knows nothing about the camera or the world.
 *
 * Keys count only while the pointer is locked, and every way of losing the
 * window or the lock clears them, so a key can never stay "held" after its
 * keyup was missed.
 */
export class PlayerInput {
  private readonly heldKeys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private state: PointerState = 'unlocked';
  private primaryDown = false;
  private lockedAtMs = 0;
  private disposed = false;

  /**
   * @param surface Element that is clicked to capture the mouse (the canvas).
   * @param onStateChange Called whenever the pointer state changes.
   */
  constructor(
    private readonly surface: HTMLElement,
    private readonly onStateChange: (state: PointerState) => void,
  ) {
    surface.addEventListener('click', this.handleClick);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.releaseInput);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handleLockChange);
    document.addEventListener('pointerlockerror', this.handleLockError);
  }

  get pointerState(): PointerState {
    return this.state;
  }

  get isLocked(): boolean {
    return this.state === 'locked';
  }

  /** True while the primary (left) mouse button is held with the mouse captured. */
  get isPrimaryHeld(): boolean {
    return this.isLocked && this.primaryDown;
  }

  /** Writes the current movement direction into `out`, each component in -1..1. */
  readAxes(out: Axes): void {
    out.x = this.axis(KEY_RIGHT, KEY_LEFT);
    out.z = this.axis(KEY_FORWARD, KEY_BACK);
  }

  /** Writes the mouse movement since the previous call into `out`, then resets it. */
  consumeLook(out: LookDelta): void {
    out.x = this.lookX;
    out.y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.surface.removeEventListener('click', this.handleClick);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.releaseInput);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    document.removeEventListener('pointerlockerror', this.handleLockError);

    this.releaseInput();
    if (document.pointerLockElement === this.surface) document.exitPointerLock();
  }

  private axis(positiveKey: string, negativeKey: string): number {
    if (!this.isLocked) return 0;
    return (this.heldKeys.has(positiveKey) ? 1 : 0) - (this.heldKeys.has(negativeKey) ? 1 : 0);
  }

  private setState(state: PointerState): void {
    if (state === this.state) return;
    this.state = state;
    this.onStateChange(state);
  }

  private readonly handleClick = (): void => {
    if (this.isLocked) return;
    try {
      // Newer browsers return a promise that rejects when the request is refused
      // (for example right after Escape); older ones fire `pointerlockerror`.
      const request: unknown = this.surface.requestPointerLock();
      if (request instanceof Promise) request.catch(this.handleLockError);
    } catch {
      this.handleLockError();
    }
  };

  private readonly handleLockChange = (): void => {
    const locked = document.pointerLockElement === this.surface;
    if (!locked) this.releaseInput();
    else this.lockedAtMs = performance.now();
    this.setState(locked ? 'locked' : 'unlocked');
  };

  private readonly handleLockError = (): void => {
    this.releaseInput();
    this.setState('failed');
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    // Browser shortcuts (Ctrl+W, Cmd+A ...) would swallow the keyup and leave the key stuck.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (MOVEMENT_KEYS.has(event.code)) this.heldKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.isLocked || performance.now() - this.lockedAtMs < LOCK_SETTLE_MS) return;
    this.lookX += clampMagnitude(event.movementX, MAX_DELTA_PER_EVENT);
    this.lookY += clampMagnitude(event.movementY, MAX_DELTA_PER_EVENT);
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) this.primaryDown = true;
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.primaryDown = false;
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.releaseInput();
  };

  /** Forgets all held keys, held buttons and pending mouse movement. */
  private readonly releaseInput = (): void => {
    this.heldKeys.clear();
    this.primaryDown = false;
    this.lookX = 0;
    this.lookY = 0;
  };
}

function clampMagnitude(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
