import { Box3, type Object3D } from 'three';
import type { Rect } from '../util/rect';

/** Set on objects the player must not walk through. */
const SOLID_FLAG = 'solid';

/** Marks an object (and everything inside it) as a solid obstacle. Returns it for chaining. */
export function markSolid<T extends Object3D>(object: T): T {
  object.userData[SOLID_FLAG] = true;
  return object;
}

/**
 * Floor footprints of every object marked solid under `root`, measured from the
 * geometry itself so collision follows the visuals when a prop is moved.
 * Footprints are axis-aligned boxes: a rotated or round object gets a slightly
 * generous footprint, which is the safe side for a first-person camera.
 */
export function collectSolidFootprints(root: Object3D): Rect[] {
  root.updateMatrixWorld(true);
  const footprints: Rect[] = [];
  const box = new Box3();

  const visit = (object: Object3D): void => {
    if (object.userData[SOLID_FLAG] === true) {
      box.setFromObject(object);
      footprints.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
      return; // children are already covered by the parent's box
    }
    object.children.forEach(visit);
  };
  visit(root);
  return footprints;
}
