/**
 * Two small, quiet screen elements: an aiming dot (only while the mouse is
 * captured) and the test panel's cleaning percentage.
 */
export class CleaningHud {
  private readonly reticle: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly value: HTMLElement;
  private readonly bar: HTMLElement;

  constructor() {
    this.reticle = document.createElement('div');
    this.reticle.className = 'reticle reticle--hidden';

    this.readout = document.createElement('div');
    this.readout.className = 'coverage';
    this.readout.setAttribute('role', 'status');
    const label = document.createElement('span');
    label.className = 'coverage__label';
    label.textContent = 'Test panel';
    this.value = document.createElement('span');
    this.value.className = 'coverage__value';
    const track = document.createElement('div');
    track.className = 'coverage__track';
    this.bar = document.createElement('div');
    this.bar.className = 'coverage__bar';
    track.appendChild(this.bar);
    this.readout.append(label, this.value, track);

    document.body.append(this.reticle, this.readout);
    this.setCoverage(0);
  }

  setAiming(active: boolean): void {
    this.reticle.classList.toggle('reticle--hidden', !active);
  }

  /** @param fraction Share of the panel's dirt removed, 0..1. */
  setCoverage(fraction: number): void {
    const percent = Math.round(fraction * 100);
    this.value.textContent = `${percent}%`;
    this.bar.style.transform = `scaleX(${fraction})`;
    this.readout.classList.toggle('coverage--active', fraction > 0);
  }

  dispose(): void {
    this.reticle.remove();
    this.readout.remove();
  }
}
