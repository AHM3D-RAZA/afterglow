import { PMREMGenerator, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Generates a small image-based-lighting map from Three's built-in procedural
 * "room". It is shown at very low intensity: it exists so metal and glass have
 * something to reflect, not to light the scene. The caller owns the returned
 * render target and must dispose it.
 */
export function createEnvironment(renderer: WebGLRenderer): WebGLRenderTarget {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = generator.fromScene(room, 0.04);
  room.dispose();
  generator.dispose();
  return target;
}
