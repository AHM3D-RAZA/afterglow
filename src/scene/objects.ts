import { Group, TorusGeometry, type Material } from 'three';
import {
  addBox,
  addMesh,
  addRod,
  createCylinderGeometry,
  createLatheGeometry,
  type Vec3,
} from '../util/geometry';
import type { WorkshopMaterials } from './materials';

/**
 * Small procedural props. Each builder returns a Group whose origin sits at the
 * object's base center, so callers only need to set a position (and yaw).
 */

export function createPaintCan(materials: WorkshopMaterials, label: Material, open = false): Group {
  const can = new Group();
  can.name = 'paint-can';
  addMesh(can, createCylinderGeometry(0.078, 0.078, 0.18, 24), materials.rawSteel, { position: [0, 0.09, 0] });
  addMesh(can, createCylinderGeometry(0.0795, 0.0795, 0.1, 24), label, { position: [0, 0.09, 0] });
  addMesh(can, createCylinderGeometry(0.084, 0.084, 0.012, 24), materials.rawSteel, { position: [0, 0.18, 0] });
  if (open) {
    // Dried paint skin inside an open can.
    addMesh(can, createCylinderGeometry(0.068, 0.068, 0.004, 20), label, { position: [0, 0.172, 0] });
  } else {
    addMesh(can, createCylinderGeometry(0.07, 0.07, 0.006, 20), materials.darkIron, { position: [0, 0.186, 0] });
  }
  return can;
}

export function createBucket(materials: WorkshopMaterials, body: Material): Group {
  const bucket = new Group();
  bucket.name = 'bucket';
  // One continuous profile: up the outside, over the rim, down the inside.
  const profile: Array<readonly [number, number]> = [
    [0, 0.004], [0.095, 0], [0.132, 0.26], [0.138, 0.27], [0.128, 0.27], [0.124, 0.256], [0.09, 0.018], [0, 0.018],
  ];
  addMesh(bucket, createLatheGeometry(profile, 28), body);
  addMesh(bucket, new TorusGeometry(0.13, 0.006, 6, 18, Math.PI), materials.rawSteel, {
    position: [0, 0.268, 0],
    castShadow: false,
  });
  return bucket;
}

export function createCardboardBox(materials: WorkshopMaterials, size: Vec3): Group {
  const box = new Group();
  box.name = 'cardboard-box';
  const [w, h, d] = size;
  addBox(box, materials.cardboard, size, [0, h / 2, 0]);
  addBox(box, materials.plasticAmber, [w * 0.18, 0.003, d + 0.004], [0, h + 0.0015, 0], { castShadow: false }); // packing tape
  addBox(box, materials.ceramic, [w * 0.3, h * 0.28, 0.003], [w * 0.15, h * 0.55, d / 2 + 0.0015], { castShadow: false }); // shipping label
  return box;
}

export function createToolbox(materials: WorkshopMaterials): Group {
  const toolbox = new Group();
  toolbox.name = 'toolbox';
  addBox(toolbox, materials.toolboxRed, [0.46, 0.2, 0.2], [0, 0.1, 0]);
  addBox(toolbox, materials.darkIron, [0.47, 0.012, 0.205], [0, 0.135, 0], { castShadow: false }); // lid seam
  addBox(toolbox, materials.rawSteel, [0.03, 0.04, 0.012], [-0.13, 0.135, 0.103]);
  addBox(toolbox, materials.rawSteel, [0.03, 0.04, 0.012], [0.13, 0.135, 0.103]);
  addRod(toolbox, materials.rawSteel, [-0.12, 0.2, 0], [-0.12, 0.25, 0], 0.006);
  addRod(toolbox, materials.rawSteel, [0.12, 0.2, 0], [0.12, 0.25, 0], 0.006);
  addRod(toolbox, materials.darkIron, [-0.12, 0.25, 0], [0.12, 0.25, 0], 0.011);
  return toolbox;
}

export function createJerryCan(materials: WorkshopMaterials): Group {
  const can = new Group();
  can.name = 'jerry-can';
  addBox(can, materials.labelRed, [0.34, 0.42, 0.16], [0, 0.21, 0]);
  addBox(can, materials.labelRed, [0.14, 0.03, 0.05], [-0.07, 0.435, 0]); // top handle
  addBox(can, materials.labelRed, [0.14, 0.03, 0.05], [-0.07, 0.38, 0], { castShadow: false });
  addMesh(can, createCylinderGeometry(0.022, 0.026, 0.07, 14), materials.darkIron, { position: [0.11, 0.455, 0] });
  return can;
}

export function createHoseCoil(materials: WorkshopMaterials, loops = 3): Group {
  const coil = new Group();
  coil.name = 'hose-coil';
  for (let i = 0; i < loops; i++) {
    addMesh(coil, new TorusGeometry(0.19 - i * 0.004, 0.024, 8, 30), materials.rubber, {
      position: [0, 0.024 + i * 0.045, 0],
      rotation: [Math.PI / 2, 0, i * 0.6],
    });
  }
  addMesh(coil, createCylinderGeometry(0.02, 0.02, 0.07, 12), materials.rawSteel, {
    position: [0.2, 0.03, 0.04],
    rotation: [0, 0, Math.PI / 2],
  }); // brass-ish nozzle stand-in
  return coil;
}

export function createMug(materials: WorkshopMaterials): Group {
  const mug = new Group();
  mug.name = 'mug';
  addMesh(mug, createCylinderGeometry(0.04, 0.036, 0.09, 20), materials.ceramic, { position: [0, 0.045, 0] });
  addMesh(mug, new TorusGeometry(0.025, 0.006, 6, 14, Math.PI), materials.ceramic, {
    position: [0.04, 0.045, 0],
    rotation: [0, 0, -Math.PI / 2],
  });
  return mug;
}

/** Spare CRT monitor: the kind of part an arcade restoration hoards. */
export function createCrtMonitor(materials: WorkshopMaterials): Group {
  const crt = new Group();
  crt.name = 'crt-monitor';
  addBox(crt, materials.plastic, [0.4, 0.36, 0.2], [0, 0.18, 0.1]);
  addBox(crt, materials.plastic, [0.3, 0.26, 0.24], [0, 0.18, -0.12]);
  addBox(crt, materials.glassDark, [0.31, 0.25, 0.012], [0, 0.19, 0.203], { castShadow: false });
  addBox(crt, materials.darkIron, [0.05, 0.015, 0.012], [0.12, 0.035, 0.203], { castShadow: false });
  return crt;
}

export function createDrum(materials: WorkshopMaterials, body: Material): Group {
  const drum = new Group();
  drum.name = 'drum';
  addMesh(drum, createCylinderGeometry(0.29, 0.29, 0.88, 28), body, { position: [0, 0.44, 0] });
  for (const y of [0.16, 0.44, 0.72]) {
    addMesh(drum, createCylinderGeometry(0.2955, 0.2955, 0.03, 28), body, { position: [0, y, 0] }); // rolled ribs
  }
  addMesh(drum, createCylinderGeometry(0.3, 0.3, 0.025, 28), materials.rawSteel, { position: [0, 0.88, 0] }); // chime
  addMesh(drum, createCylinderGeometry(0.265, 0.265, 0.01, 28), materials.darkIron, { position: [0, 0.885, 0] });
  for (const [x, z] of [[0.1, 0.06], [-0.11, -0.05]] as const) {
    addMesh(drum, createCylinderGeometry(0.03, 0.03, 0.014, 14), materials.rawSteel, { position: [x, 0.895, z] }); // bungs
  }
  return drum;
}

/** Slatted wooden crate: a plain box with proud slat bands and corner posts. */
export function createCrate(materials: WorkshopMaterials, edge = 0.6): Group {
  const crate = new Group();
  crate.name = 'crate';
  const h = edge * 0.85;
  addBox(crate, materials.crateWood, [edge, h, edge], [0, h / 2, 0]);
  for (const y of [h * 0.18, h * 0.5, h * 0.82]) {
    addBox(crate, materials.crateWood, [edge + 0.02, 0.07, edge + 0.02], [0, y, 0]);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(crate, materials.crateWood, [0.055, h + 0.02, 0.055], [(sx * (edge + 0.02)) / 2, h / 2, (sz * (edge + 0.02)) / 2]);
    }
  }
  return crate;
}

export function createTire(materials: WorkshopMaterials): Group {
  const tire = new Group();
  tire.name = 'tire';
  addMesh(tire, new TorusGeometry(0.26, 0.1, 14, 30), materials.rubber, {
    position: [0, 0.1, 0],
    rotation: [Math.PI / 2, 0, 0],
  });
  return tire;
}

/** Upright mop: a wooden handle with a tapered fabric head at the bottom. */
export function createMop(materials: WorkshopMaterials): Group {
  const mop = new Group();
  mop.name = 'mop';
  addRod(mop, materials.benchWood, [0, 0.14, 0], [0, 1.3, 0], 0.012);
  addMesh(mop, createCylinderGeometry(0.03, 0.1, 0.16, 12), materials.fabric, { position: [0, 0.08, 0] });
  return mop;
}
