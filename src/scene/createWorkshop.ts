import { Color, FogExp2, Group, Scene } from 'three';
import { PALETTE } from '../config';
import { disposeObject3D } from '../util/dispose';
import type { Rect } from '../util/rect';
import { createArcadeCabinet } from './arcadeCabinet';
import { collectSolidFootprints } from './colliders';
import { createLighting } from './lighting';
import { createMaterials } from './materials';
import { createFloorProps } from './props';
import { createRoom } from './room';
import { createShelving } from './shelving';
import { createWorkbench } from './workbench';

export interface Workshop {
  readonly scene: Scene;
  /** Floor footprints of solid furniture and props, for player collision. */
  readonly solidFootprints: readonly Rect[];
  /** Advances anything animated (currently just the flickering pendant). */
  update(elapsedSeconds: number): void;
  /** Releases every geometry, material, texture and shadow map the workshop owns. */
  dispose(): void;
}

/** Assembles the workshop scene. Each part lives in its own module; this only composes them. */
export function createWorkshop(): Workshop {
  const scene = new Scene();
  scene.name = 'workshop';
  scene.background = new Color(PALETTE.haze);
  // Dusty indoor air: just enough to push the far wall back and soften the corners.
  scene.fog = new FogExp2(PALETTE.haze, 0.045);

  const materials = createMaterials();
  const lighting = createLighting(materials);

  const contents = new Group();
  contents.name = 'workshop-contents';
  contents.add(
    createRoom(materials),
    createWorkbench(materials),
    createShelving(materials),
    createArcadeCabinet(materials),
    createFloorProps(materials),
    lighting.group,
  );
  scene.add(contents);

  return {
    scene,
    solidFootprints: collectSolidFootprints(contents),
    update: lighting.update,
    dispose: () => disposeObject3D(contents),
  };
}
