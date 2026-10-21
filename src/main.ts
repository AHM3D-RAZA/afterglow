import './style.css';
import { App } from './core/App';
import { StatusDisplay } from './core/StatusDisplay';

async function bootstrap(): Promise<void> {
  const container = requireElement('app');
  const status = new StatusDisplay(requireElement('status'));
  status.showMessage('Preparing the workshop');

  // Surface problems on screen instead of leaving a black page. The first error wins.
  window.addEventListener('error', (event) => {
    // Opaque cross-origin "Script error." events (e.g. browser extensions) carry no error object.
    if (event.error) status.showError(event.error);
  });
  window.addEventListener('unhandledrejection', (event) => status.showError(event.reason));

  // Let the browser paint the status text before the synchronous texture generation begins.
  await nextPaint();

  try {
    const app = new App(container);

    // A lost GL context is recoverable: cancelling the default lets the browser restore it.
    app.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      status.showMessage('Graphics context lost. Waiting for the browser to restore it');
    });
    app.renderer.domElement.addEventListener('webglcontextrestored', () => status.hide());

    if (import.meta.env.DEV) {
      // Dynamic import: the debug overlay is not part of production bundles.
      const { DebugOverlay } = await import('./debug/DebugOverlay');
      new DebugOverlay(app.renderer);
      // Console access for development: `afterglow.camera`, `afterglow.renderer.info`, ...
      Object.assign(window, { afterglow: app });
    }

    app.start();
    status.hide();
  } catch (error) {
    status.showError(error);
  }
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id} element in index.html.`);
  return element;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

void bootstrap();
