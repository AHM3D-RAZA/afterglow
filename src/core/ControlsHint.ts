import type { PointerState } from '../player/input';

const HIDE_AFTER_MS = 6000;

const MESSAGES: Record<PointerState, string> = {
  unlocked: 'Click to look around',
  locked: 'W A S D to move · Mouse to look · Esc to release',
  failed: 'The browser blocked mouse capture. Click again to retry',
};

/**
 * One quiet line of text at the bottom of the screen. Before the mouse is
 * captured it says how to capture it; right after, it recalls the controls
 * and then fades away so it never competes with the scene.
 */
export class ControlsHint {
  private readonly element: HTMLElement;
  private hideTimer: number | undefined;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'controls-hint controls-hint--hidden'; // revealed by show(), once the scene is up
    this.element.setAttribute('role', 'status');
    document.body.appendChild(this.element);
  }

  show(state: PointerState): void {
    window.clearTimeout(this.hideTimer);
    this.element.textContent = MESSAGES[state];
    this.element.classList.remove('controls-hint--hidden');
    if (state === 'locked') {
      this.hideTimer = window.setTimeout(() => this.element.classList.add('controls-hint--hidden'), HIDE_AFTER_MS);
    }
  }

  dispose(): void {
    window.clearTimeout(this.hideTimer);
    this.element.remove();
  }
}
