/** Full-screen status panel used for initialization messages and fatal errors. */
export class StatusDisplay {
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private hasError = false;

  constructor(private readonly root: HTMLElement) {
    const title = root.querySelector<HTMLElement>('.status__title');
    const detail = root.querySelector<HTMLElement>('.status__detail');
    if (!title || !detail) {
      throw new Error('Status element is missing its .status__title / .status__detail children.');
    }
    this.title = title;
    this.detail = detail;
  }

  showMessage(message: string): void {
    if (this.hasError) return;
    this.title.textContent = message;
    this.detail.textContent = '';
    this.root.classList.remove('status--hidden');
  }

  /** Shows the first error only; later ones are usually cascades of the first. */
  showError(error: unknown): void {
    console.error(error);
    if (this.hasError) return;
    this.hasError = true;
    this.title.textContent = 'AFTERGLOW could not start';
    this.detail.textContent = `${describeError(error)}\n\nSee the browser console for details.`;
    this.root.classList.add('status--error');
    this.root.classList.remove('status--hidden');
  }

  hide(): void {
    if (this.hasError) return;
    this.root.classList.add('status--hidden');
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred.';
}
