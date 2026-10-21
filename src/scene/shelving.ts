import { Group } from 'three';
import { LAYOUT } from '../config';
import { addBox, addMesh, addRod, createCylinderGeometry, type Vec3 } from '../util/geometry';
import type { WorkshopMaterials } from './materials';
import {
  createBucket,
  createCardboardBox,
  createCrtMonitor,
  createHoseCoil,
  createJerryCan,
  createPaintCan,
} from './objects';

const WIDTH = 1.6;
const DEPTH = 0.5;
const HEIGHT = 2.1;
const BOARD_THICKNESS = 0.03;
/** Heights of the shelf boards' top surfaces. */
const LEVELS = [0.2, 0.7, 1.2, 1.7] as const;

/**
 * Freestanding steel shelving against the right wall, facing into the room.
 * Local origin: floor, centered on the footprint, front toward +Z.
 */
export function createShelving(materials: WorkshopMaterials): Group {
  const unit = new Group();
  unit.name = 'shelving';
  unit.position.set(...LAYOUT.shelving.position);
  unit.rotation.y = LAYOUT.shelving.rotationY;

  addStructure(unit, materials);
  addLevelZero(unit, materials);
  addLevelOne(unit, materials);
  addLevelTwo(unit, materials);
  addLevelThree(unit, materials);

  return unit;
}

function addStructure(unit: Group, materials: WorkshopMaterials): void {
  for (const x of [-WIDTH / 2 + 0.025, WIDTH / 2 - 0.025]) {
    for (const z of [-DEPTH / 2 + 0.025, DEPTH / 2 - 0.025]) {
      addBox(unit, materials.shelfSteel, [0.05, HEIGHT, 0.05], [x, HEIGHT / 2, z], { name: 'shelf-post' });
    }
  }
  for (const level of LEVELS) {
    addBox(unit, materials.shelfSteel, [WIDTH, BOARD_THICKNESS, DEPTH], [0, level - BOARD_THICKNESS / 2, 0], { name: 'shelf-board' });
    addBox(unit, materials.shelfSteel, [WIDTH, 0.06, 0.015], [0, level - 0.03, DEPTH / 2 - 0.0075], { name: 'shelf-lip' });
  }
  // Back cross-brace keeps the unit rigid and adds a little visual rhythm.
  addRod(unit, materials.darkSteel, [-WIDTH / 2 + 0.03, 0.2, -DEPTH / 2 + 0.01], [WIDTH / 2 - 0.03, 1.7, -DEPTH / 2 + 0.01], 0.008, { name: 'shelf-brace' });
}

function place<T extends Group>(unit: Group, object: T, position: Vec3, yaw = 0): T {
  object.position.set(...position);
  object.rotation.y = yaw;
  unit.add(object);
  return object;
}

function addLevelZero(unit: Group, materials: WorkshopMaterials): void {
  const y = LEVELS[0];
  place(unit, createCrtMonitor(materials), [-0.42, y, 0.0], 0.15);
  place(unit, createBucket(materials, materials.plastic), [0.38, y, 0.08]);
  place(unit, createCardboardBox(materials, [0.3, 0.22, 0.26]), [0.1, y, -0.08], -0.2);
}

function addLevelOne(unit: Group, materials: WorkshopMaterials): void {
  const y = LEVELS[1];
  const labels = [materials.labelRed, materials.labelBlue, materials.labelMustard, materials.labelBlue, materials.labelRed];
  labels.forEach((label, i) => {
    place(unit, createPaintCan(materials, label), [-0.65 + i * 0.19, y, 0.1 - (i % 2) * 0.12], i * 0.7);
  });
  // A second tier of cans on the first two, to look hurriedly stacked.
  place(unit, createPaintCan(materials, materials.labelMustard, true), [-0.65, y + 0.18, 0.1]);
  place(unit, createPaintCan(materials, materials.labelRed), [-0.46, y + 0.18, -0.02]);
  place(unit, createJerryCan(materials), [0.42, y, 0.02], 0.25);
}

function addLevelTwo(unit: Group, materials: WorkshopMaterials): void {
  const y = LEVELS[2];
  place(unit, createCardboardBox(materials, [0.36, 0.3, 0.32]), [-0.55, y, 0.0], 0.1);
  place(unit, createCardboardBox(materials, [0.3, 0.22, 0.28]), [-0.15, y, 0.04], -0.18);
  place(unit, createCardboardBox(materials, [0.42, 0.26, 0.3]), [0.35, y, -0.02], 0.06);
  place(unit, createCardboardBox(materials, [0.26, 0.18, 0.24]), [0.38, y + 0.26, -0.02], 0.4);
}

function addLevelThree(unit: Group, materials: WorkshopMaterials): void {
  const y = LEVELS[3];

  // Folded tarps.
  addBox(unit, materials.tarpBlue, [0.5, 0.1, 0.34], [-0.45, y + 0.05, 0.0], { name: 'tarp-folded-blue', rotation: [0, 0.05, 0] });
  addBox(unit, materials.tarpOlive, [0.46, 0.08, 0.32], [-0.44, y + 0.14, 0.01], { name: 'tarp-folded-olive', rotation: [0, -0.08, 0] });

  place(unit, createHoseCoil(materials), [0.1, y, 0.02]);

  // Bottles, loosely lined up near the front edge.
  [0.45, 0.53, 0.61].forEach((x, i) => {
    const bottle = new Group();
    bottle.name = 'bottle';
    addMesh(bottle, createCylinderGeometry(0.032, 0.032, 0.2, 14), materials.plasticAmber, { position: [0, 0.1, 0] });
    addMesh(bottle, createCylinderGeometry(0.014, 0.02, 0.04, 10), materials.plasticAmber, { position: [0, 0.22, 0] });
    addMesh(bottle, createCylinderGeometry(0.017, 0.017, 0.02, 10), materials.darkIron, { position: [0, 0.25, 0] });
    place(unit, bottle, [x, y, 0.12 - i * 0.03]);
  });
}
