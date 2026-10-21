import { ACESFilmicToneMapping, PCFShadowMap, WebGLRenderer } from 'three';
import { RENDERER } from '../config';

/**
 * Creates the WebGL renderer and attaches its canvas to `container`.
 * Throws if the browser cannot create a WebGL context; the caller reports it.
 */
export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERER.maxPixelRatio));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDERER.toneMappingExposure;

  // PCFShadowMap is the soft-shadow mode in current Three.js (PCFSoftShadowMap
  // was removed); per-light `shadow.radius` controls how soft the edges are.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  container.appendChild(renderer.domElement);
  return renderer;
}
