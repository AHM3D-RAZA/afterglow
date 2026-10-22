import {
  ExtrudeGeometry,
  Group,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SphereGeometry,
} from 'three';
import { LAYOUT } from '../config';
import { createMarqueeTexture } from '../procedural/marquee';
import { addBox, addMesh, addRod, createCylinderGeometry } from '../util/geometry';
import { markSolid } from './colliders';
import type { WorkshopMaterials } from './materials';

const WIDTH = 0.64;

/**
 * Side profile of a classic upright cabinet, as (forward, up) points in meters.
 * Forward is toward the player. The profile is what makes it read as an arcade
 * machine from across the room: control-panel lip, reclined screen, marquee overhang.
 */
const SIDE_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [-0.42, 0.0],
  [0.34, 0.0],
  [0.34, 0.82], // front face up to the control panel
  [0.47, 0.9], // panel lip
  [0.47, 0.96],
  [0.32, 1.0], // panel meets the screen bezel
  [0.2, 1.58], // reclined screen face
  [0.34, 1.6], // underside of the marquee overhang
  [0.34, 1.88],
  [-0.28, 1.88],
  [-0.42, 1.6], // angled back
];

/** Screen face geometry derived from the profile, used to seat bezel and glass. */
const SCREEN_BOTTOM = { forward: 0.32, up: 1.0 };
const SCREEN_TOP = { forward: 0.2, up: 1.58 };

/**
 * Placeholder arcade cabinet: the focal point of the workshop, and the thing
 * later milestones will let the player restore. Dead, dusty and dark.
 * Local origin: floor, centered, front toward +Z.
 */
export function createArcadeCabinet(materials: WorkshopMaterials): Group {
  const cabinet = new Group();
  cabinet.name = 'arcade-cabinet';
  cabinet.position.set(...LAYOUT.arcade.position);
  cabinet.rotation.y = LAYOUT.arcade.rotationY;

  addBody(cabinet, materials);
  addMarquee(cabinet);
  addScreen(cabinet, materials);
  addControlPanel(cabinet, materials);
  addCoinDoor(cabinet, materials);

  return markSolid(cabinet);
}

function addBody(cabinet: Group, materials: WorkshopMaterials): void {
  const shape = new Shape();
  SIDE_PROFILE.forEach(([forward, up], i) => (i === 0 ? shape.moveTo(forward, up) : shape.lineTo(forward, up)));
  shape.closePath();

  const bevel = 0.012;
  const geometry = new ExtrudeGeometry(shape, {
    depth: WIDTH - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    // Pull the bevel inward so the side walls sit exactly on the profile outline.
    bevelOffset: -bevel,
    bevelSegments: 2,
  });
  // Extrusion runs along +Z; turn it so the shape's "forward" faces +Z and the width runs along X.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(WIDTH / 2 - bevel, 0, 0);

  addMesh(cabinet, geometry, materials.arcadeBody, { name: 'cabinet-body' });
}

function addMarquee(cabinet: Group): void {
  const material = new MeshStandardMaterial({ map: createMarqueeTexture(), roughness: 0.55 });
  addMesh(cabinet, new PlaneGeometry(WIDTH - 0.06, 0.25), material, {
    name: 'marquee',
    position: [0, 1.74, 0.34 + 0.003],
    castShadow: false,
  });
}

function addScreen(cabinet: Group, materials: WorkshopMaterials): void {
  const rise = SCREEN_TOP.up - SCREEN_BOTTOM.up;
  const run = SCREEN_TOP.forward - SCREEN_BOTTOM.forward; // negative: the screen leans back
  const length = Math.hypot(rise, run);
  const lean = Math.atan2(-run, rise);
  const middle = {
    up: (SCREEN_TOP.up + SCREEN_BOTTOM.up) / 2,
    forward: (SCREEN_TOP.forward + SCREEN_BOTTOM.forward) / 2,
  };
  // Unit normal of the sloped face, in (forward, up) space.
  const normal = { forward: rise / length, up: -run / length };

  const mount = (width: number, height: number, lift: number, material: MeshStandardMaterial, name: string, along = 0) => {
    const plane = addMesh(cabinet, new PlaneGeometry(width, height), material, {
      name,
      position: [
        0,
        middle.up + normal.up * lift + (rise / length) * along,
        middle.forward + normal.forward * lift + (run / length) * along,
      ],
      castShadow: false,
    });
    plane.rotation.x = -lean;
  };

  mount(WIDTH - 0.04, length, 0.004, materials.chip, 'screen-bezel');
  mount(WIDTH - 0.17, length - 0.17, 0.008, materials.glassDark, 'screen-glass', 0.015);
}

function addControlPanel(cabinet: Group, materials: WorkshopMaterials): void {
  const panel = new Group();
  panel.name = 'control-panel';
  // Matches the slight rise of the profile between the panel lip and the bezel.
  panel.position.set(0, 0.982, 0.395);
  panel.rotation.x = 0.26;
  cabinet.add(panel);

  addBox(panel, materials.darkSteel, [WIDTH - 0.04, 0.014, 0.17], [0, 0.007, 0], { name: 'panel-plate' });

  const buttonColors = [materials.labelRed, materials.labelMustard, materials.labelBlue];
  for (const side of [-1, 1]) {
    const stickX = side * 0.2;
    addMesh(panel, createCylinderGeometry(0.032, 0.032, 0.008, 18), materials.darkIron, { position: [stickX, 0.018, 0.0] });
    addRod(panel, materials.rawSteel, [stickX, 0.02, 0], [stickX, 0.115, 0], 0.005, { name: 'joystick-shaft' });
    addMesh(panel, new SphereGeometry(0.024, 14, 10), materials.labelRed, { name: 'joystick-ball', position: [stickX, 0.125, 0] });

    buttonColors.forEach((color, i) => {
      const x = side * (0.095 + i * 0.05);
      const z = 0.025 - i * 0.012;
      addMesh(panel, createCylinderGeometry(0.02, 0.02, 0.006, 16), materials.darkIron, { position: [x, 0.017, z] });
      addMesh(panel, createCylinderGeometry(0.015, 0.016, 0.012, 16), color, { name: 'panel-button', position: [x, 0.025, z] });
    });
  }
}

function addCoinDoor(cabinet: Group, materials: WorkshopMaterials): void {
  const door = new Group();
  door.name = 'coin-door';
  door.position.set(0, 0.4, 0.34);
  cabinet.add(door);

  addBox(door, materials.darkIron, [0.2, 0.28, 0.012], [0, 0, 0.006], { name: 'coin-plate' });
  for (const x of [-0.045, 0.045]) {
    addBox(door, materials.chip, [0.024, 0.05, 0.014], [x, 0.05, 0.008], { name: 'coin-slot' });
    addBox(door, x < 0 ? materials.labelRed : materials.labelMustard, [0.04, 0.034, 0.008], [x, 0.0, 0.01], { name: 'coin-lens' });
    addMesh(door, createCylinderGeometry(0.013, 0.013, 0.008, 12), materials.rawSteel, {
      name: 'coin-return',
      position: [x, -0.07, 0.01],
      rotation: [Math.PI / 2, 0, 0],
    });
  }

  addBox(cabinet, materials.darkSteel, [0.34, 0.2, 0.01], [0, 0.17, 0.343], { name: 'cash-box-door' });
  addBox(cabinet, materials.rawSteel, [0.05, 0.02, 0.012], [0.1, 0.19, 0.35], { name: 'cash-box-lock' });
}
