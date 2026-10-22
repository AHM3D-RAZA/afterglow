import { Group } from 'three';
import { addBox, addRod } from '../util/geometry';
import { markSolid } from './colliders';
import type { WorkshopMaterials } from './materials';
import {
  createBucket,
  createCardboardBox,
  createCrate,
  createDrum,
  createHoseCoil,
  createMop,
  createTire,
} from './objects';

/**
 * Loose floor clutter. Placement is deliberate: it frames the camera view
 * (foreground crates), balances the back-right corner (drums) and keeps the
 * center of the floor open so the daylight and the focal point read clearly.
 */
export function createFloorProps(materials: WorkshopMaterials): Group {
  const props = new Group();
  props.name = 'floor-props';

  // Right wall, in front of the shelving: a cluster of drums that frames the right edge.
  const drumA = createDrum(materials, materials.drumBlue);
  drumA.position.set(3.4, 0, -2.3);
  props.add(markSolid(drumA));

  const drumB = createDrum(materials, materials.drumRust);
  drumB.position.set(3.45, 0, -1.55);
  drumB.rotation.y = 1.2;
  props.add(markSolid(drumB));

  const drumC = createDrum(materials, materials.drumRust);
  drumC.position.set(2.8, 0, -2.0);
  drumC.rotation.y = 0.7;
  props.add(markSolid(drumC));

  // Foreground left: crate stack. Partially out of frame, it gives the scene a near plane.
  const crateA = createCrate(materials, 0.62);
  crateA.position.set(-3.1, 0, 1.6);
  crateA.rotation.y = 0.12;
  props.add(markSolid(crateA));

  const crateB = createCrate(materials, 0.6);
  crateB.position.set(-3.18, 0.527, 1.58);
  crateB.rotation.y = -0.18;
  props.add(markSolid(crateB));

  const crateC = createCrate(materials, 0.52);
  crateC.position.set(-2.45, 0, 2.05);
  crateC.rotation.y = 0.5;
  props.add(markSolid(crateC));

  // Cardboard on the floor near the arcade cabinet's flank.
  const box = createCardboardBox(materials, [0.5, 0.34, 0.38]);
  box.position.set(-3.1, 0, -2.9);
  box.rotation.y = 0.3;
  props.add(markSolid(box));

  // Mop and bucket by the left wall.
  const bucket = createBucket(materials, materials.plasticAmber);
  bucket.position.set(-3.5, 0, -0.4);
  props.add(markSolid(bucket));
  const mop = createMop(materials);
  mop.position.set(-3.5, 0.02, -0.4);
  mop.rotation.z = 0.12;
  props.add(markSolid(mop));

  // Tire stack on the right, mid-room: breaks up the long wall line.
  [0, 0.2].forEach((y, i) => {
    const tire = createTire(materials);
    tire.position.set(3.3, y, 0.85 + i * 0.02);
    tire.rotation.y = i * 0.5;
    props.add(markSolid(tire));
  });

  // Hose coil in the open floor near the bench: a trip hazard that leads the eye toward it.
  const hose = createHoseCoil(materials, 4);
  hose.position.set(-0.4, 0, -1.9);
  hose.rotation.y = 0.4;
  props.add(hose);

  // Floor drain.
  addBox(props, materials.darkIron, [0.46, 0.012, 0.46], [0.8, 0.004, -0.6], { name: 'floor-drain', castShadow: false });
  for (let i = -2; i <= 2; i++) {
    addBox(props, materials.chip, [0.4, 0.014, 0.018], [0.8, 0.007, -0.6 + i * 0.08], { name: 'drain-slot', castShadow: false });
  }

  // A length of steel pipe lying across the floor.
  addRod(props, materials.rawSteel, [-2.0, 0.035, 0.7], [-0.4, 0.035, 0.75], 0.035, { name: 'loose-pipe' });

  return props;
}
