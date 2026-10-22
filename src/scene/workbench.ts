import { Group, SpotLight, SphereGeometry, TorusGeometry } from 'three';
import { LAYOUT, PALETTE } from '../config';
import {
  addBox,
  addMesh,
  addRod,
  createCylinderGeometry,
  LAY_ALONG_X,
  type Vec3,
} from '../util/geometry';
import { markSolid } from './colliders';
import type { WorkshopMaterials } from './materials';
import {
  createBucket,
  createCardboardBox,
  createMug,
  createPaintCan,
  createToolbox,
} from './objects';

const TOP_Y = 0.9;
/** Local z of the wall behind the bench (the bench group sits 0.42 m off the wall). */
const WALL_Z = -0.42;

/**
 * The workbench against the back wall, with its pegboard, tools and clutter.
 * Local origin: floor, centered on the bench footprint, front toward +Z.
 */
export function createWorkbench(materials: WorkshopMaterials): Group {
  const bench = new Group();
  bench.name = 'workbench';
  bench.position.set(...LAYOUT.workbench.position);

  addFrame(bench, materials);
  addDrawers(bench, materials);
  addPegboard(bench, materials);
  addVise(bench, materials);
  addLamp(bench, materials);
  addTopClutter(bench, materials);
  addLowerShelfClutter(bench, materials);

  return markSolid(bench);
}

function addFrame(bench: Group, materials: WorkshopMaterials): void {
  addBox(bench, materials.benchWood, [2.4, 0.06, 0.8], [0, TOP_Y - 0.03, 0], { name: 'bench-top' });
  for (const z of [-0.355, 0.355]) {
    addBox(bench, materials.darkSteel, [2.3, 0.07, 0.03], [0, 0.79, z], { name: 'bench-apron' });
  }
  for (const x of [-1.14, 1.14]) {
    for (const z of [-0.34, 0.34]) {
      addBox(bench, materials.darkSteel, [0.07, 0.84, 0.07], [x, 0.42, z], { name: 'bench-leg' });
    }
    addBox(bench, materials.darkSteel, [0.04, 0.05, 0.62], [x, 0.16, 0], { name: 'bench-stretcher' });
  }
  addBox(bench, materials.shelfBoard, [2.3, 0.03, 0.7], [0, 0.22, 0], { name: 'bench-lower-shelf' });
}

/** Drawer unit under the right half; the middle drawer has been left ajar. */
function addDrawers(bench: Group, materials: WorkshopMaterials): void {
  const unitX = 0.78;
  addBox(bench, materials.darkSteel, [0.66, 0.56, 0.62], [unitX, 0.53, -0.02], { name: 'drawer-unit' });

  const fronts = [
    { y: 0.35, pulled: 0 },
    { y: 0.54, pulled: 0.15 },
    { y: 0.73, pulled: 0 },
  ];
  for (const { y, pulled } of fronts) {
    const z = 0.31 + pulled;
    addBox(bench, materials.shelfSteel, [0.62, 0.17, 0.025], [unitX, y, z + 0.0125], { name: 'drawer-front' });
    addBox(bench, materials.rawSteel, [0.2, 0.02, 0.025], [unitX, y + 0.04, z + 0.035], { name: 'drawer-handle' });
    if (pulled > 0) {
      // The exposed drawer box, so the ajar drawer is not just a floating front panel.
      addBox(bench, materials.darkSteel, [0.58, 0.11, pulled], [unitX, y - 0.01, 0.31 + pulled / 2 - 0.005], { name: 'drawer-box' });
      addBox(bench, materials.chip, [0.5, 0.012, pulled - 0.03], [unitX, y - 0.045, 0.3 + pulled / 2], { name: 'drawer-liner' });
    }
  }
}

function addPegboard(bench: Group, materials: WorkshopMaterials): void {
  addBox(bench, materials.pegboard, [2.2, 0.95, 0.02], [0, 1.725, WALL_Z + 0.01], { name: 'pegboard' });

  const face = WALL_Z + 0.02;
  // Hammer
  addBox(bench, materials.benchWood, [0.03, 0.32, 0.025], [-0.8, 1.78, face + 0.0125], { name: 'hammer-handle' });
  addBox(bench, materials.rawSteel, [0.13, 0.05, 0.04], [-0.8, 1.96, face + 0.02], { name: 'hammer-head' });
  // Two spanners
  for (const [x, tilt] of [[-0.5, 0.05], [-0.42, -0.04]] as const) {
    addBox(bench, materials.rawSteel, [0.026, 0.34, 0.012], [x, 1.77, face + 0.006], { name: 'spanner', rotation: [0, 0, tilt] });
    addBox(bench, materials.rawSteel, [0.07, 0.07, 0.012], [x, 1.95, face + 0.006], { name: 'spanner-head', rotation: [0, 0, tilt] });
  }
  // Pliers
  for (const dx of [-0.012, 0.012]) {
    addBox(bench, materials.labelRed, [0.02, 0.15, 0.014], [-0.1 + dx, 1.72, face + 0.007], { name: 'pliers-handle', rotation: [0, 0, dx * 3] });
  }
  addBox(bench, materials.rawSteel, [0.04, 0.07, 0.012], [-0.1, 1.84, face + 0.006], { name: 'pliers-head' });
  // Hand saw
  addBox(bench, materials.rawSteel, [0.5, 0.1, 0.004], [0.5, 1.58, face + 0.002], { name: 'saw-blade' });
  addBox(bench, materials.benchWood, [0.11, 0.11, 0.02], [0.8, 1.58, face + 0.01], { name: 'saw-handle' });
  // Coiled cable on a peg
  addMesh(bench, new TorusGeometry(0.1, 0.022, 8, 24), materials.rubber, {
    name: 'cable-coil',
    position: [0.2, 1.9, face + 0.03],
  });
}

function addVise(bench: Group, materials: WorkshopMaterials): void {
  const vise = new Group();
  vise.name = 'vise';
  vise.position.set(1.0, TOP_Y, 0.2);
  bench.add(vise);

  addBox(vise, materials.darkIron, [0.17, 0.05, 0.2], [0, 0.025, 0]);
  addBox(vise, materials.darkIron, [0.15, 0.1, 0.1], [0, 0.1, -0.04]);
  addBox(vise, materials.rawSteel, [0.14, 0.07, 0.025], [0, 0.11, 0.035]);
  addBox(vise, materials.rawSteel, [0.14, 0.07, 0.03], [0, 0.11, 0.1]);
  addRod(vise, materials.rawSteel, [0, 0.11, 0.1], [0, 0.11, 0.26], 0.011);
  addRod(vise, materials.rawSteel, [-0.09, 0.11, 0.25], [0.09, 0.11, 0.25], 0.007);
}

/** Articulated work lamp. Its SpotLight is the only practical light on the bench. */
function addLamp(bench: Group, materials: WorkshopMaterials): void {
  const lamp = new Group();
  lamp.name = 'work-lamp';
  lamp.position.set(-0.95, TOP_Y, -0.15);
  bench.add(lamp);

  const elbow: Vec3 = [0.02, 0.5, -0.08];
  const head: Vec3 = [0.3, 0.6, -0.02];

  addMesh(lamp, createCylinderGeometry(0.075, 0.085, 0.025, 20), materials.darkIron, { position: [0, 0.0125, 0] });
  addRod(lamp, materials.darkIron, [0, 0.02, 0], elbow, 0.008);
  addRod(lamp, materials.darkIron, elbow, head, 0.008);
  addMesh(lamp, new SphereGeometry(0.016, 10, 8), materials.rawSteel, { position: elbow });

  addMesh(lamp, createCylinderGeometry(0.035, 0.11, 0.13, 20, true), materials.enamelShade, {
    name: 'lamp-shade',
    position: [head[0] + 0.01, head[1] - 0.05, head[2]],
    rotation: [0, 0, 0.45],
    castShadow: false,
  });
  addMesh(lamp, new SphereGeometry(0.032, 12, 10), materials.bulbOn, {
    position: [head[0] + 0.02, head[1] - 0.09, head[2]],
    castShadow: false,
  });

  const light = new SpotLight(PALETTE.amberHot, 14, 0, 0.75, 0.85, 2);
  light.position.set(head[0] + 0.03, head[1] - 0.1, head[2]);
  light.target.position.set(head[0] + 0.45, -0.1, head[2] + 0.2);
  lamp.add(light, light.target);
}

function addTopClutter(bench: Group, materials: WorkshopMaterials): void {
  // Arcade PCB pulled out for repair, with a few components.
  const board = new Group();
  board.name = 'arcade-pcb';
  board.position.set(-0.4, TOP_Y, 0.12);
  board.rotation.y = 0.25;
  bench.add(board);
  addBox(board, materials.circuitBoard, [0.3, 0.012, 0.22], [0, 0.006, 0]);
  for (const [x, z, w] of [[-0.07, -0.03, 0.05], [0.0, 0.0, 0.07], [0.07, -0.04, 0.04], [0.05, 0.05, 0.05]] as const) {
    addBox(board, materials.chip, [w, 0.012, 0.03], [x, 0.018, z]);
  }
  addBox(board, materials.gold, [0.12, 0.014, 0.02], [0, 0.007, 0.115], { castShadow: false });
  for (const [x, z] of [[-0.11, 0.06], [-0.09, 0.07], [0.12, 0.06]] as const) {
    addMesh(board, createCylinderGeometry(0.007, 0.007, 0.02, 10), materials.labelBlue, { position: [x, 0.022, z] });
  }

  // Parts tray with a few loose screws.
  const tray = new Group();
  tray.name = 'parts-tray';
  tray.position.set(0.15, TOP_Y, 0.15);
  tray.rotation.y = -0.1;
  bench.add(tray);
  addBox(tray, materials.darkSteel, [0.3, 0.008, 0.2], [0, 0.004, 0]);
  addBox(tray, materials.darkSteel, [0.3, 0.035, 0.008], [0, 0.0225, -0.096]);
  addBox(tray, materials.darkSteel, [0.3, 0.035, 0.008], [0, 0.0225, 0.096]);
  addBox(tray, materials.darkSteel, [0.008, 0.035, 0.2], [-0.146, 0.0225, 0]);
  addBox(tray, materials.darkSteel, [0.008, 0.035, 0.2], [0.146, 0.0225, 0]);
  for (const [x, z, angle] of [[-0.07, -0.03, 0.4], [-0.02, 0.04, 1.9], [0.05, -0.05, 2.7], [0.09, 0.03, 0.9], [0.0, -0.01, 1.3]] as const) {
    addMesh(tray, createCylinderGeometry(0.004, 0.004, 0.028, 8), materials.rawSteel, {
      position: [x, 0.012, z],
      rotation: [Math.PI / 2, 0, angle],
      castShadow: false,
    });
  }

  const cans: Array<{ x: number; z: number; label: 'labelRed' | 'labelMustard'; open: boolean }> = [
    { x: -0.05, z: -0.24, label: 'labelMustard', open: true },
    { x: 0.1, z: -0.27, label: 'labelRed', open: false },
  ];
  for (const { x, z, label, open } of cans) {
    const can = createPaintCan(materials, materials[label], open);
    can.position.set(x, TOP_Y, z);
    bench.add(can);
  }

  const mug = createMug(materials);
  mug.position.set(0.5, TOP_Y, -0.26);
  mug.rotation.y = 2.4;
  bench.add(mug);

  // Crumpled rag: a squashed lump is enough at this distance.
  addMesh(bench, new SphereGeometry(0.07, 12, 8), materials.fabric, {
    name: 'rag',
    position: [-0.7, TOP_Y + 0.02, 0.2],
  }).scale.set(1.5, 0.45, 1);

  // Oil can lying on its side.
  addMesh(bench, createCylinderGeometry(0.035, 0.035, 0.12, 14), materials.rawSteel, {
    name: 'oil-can',
    position: [0.46, TOP_Y + 0.035, 0.0],
    rotation: [0, 0.5, Math.PI / 2],
  });
  addRod(bench, materials.rawSteel, [0.4, TOP_Y + 0.045, 0.02], [0.33, TOP_Y + 0.07, 0.04], 0.006, { name: 'oil-can-spout' });
}

function addLowerShelfClutter(bench: Group, materials: WorkshopMaterials): void {
  const shelfTop = 0.235;

  const toolbox = createToolbox(materials);
  toolbox.position.set(-0.55, shelfTop, 0.02);
  toolbox.rotation.y = 0.08;
  bench.add(toolbox);

  const bucket = createBucket(materials, materials.plasticAmber);
  bucket.position.set(-0.98, shelfTop, 0.05);
  bench.add(bucket);

  const box = createCardboardBox(materials, [0.4, 0.28, 0.3]);
  box.position.set(0.0, shelfTop, 0.0);
  box.rotation.y = -0.12;
  bench.add(box);

  // Rolled-up tarp lying along the shelf.
  addMesh(bench, createCylinderGeometry(0.06, 0.06, 0.6, 16), materials.tarpBlue, {
    name: 'tarp-roll',
    position: [-0.25, shelfTop + 0.06, -0.2],
    rotation: LAY_ALONG_X,
  });
}
