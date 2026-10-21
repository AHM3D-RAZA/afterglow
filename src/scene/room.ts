import { Group } from 'three';
import { ROOM } from '../config';
import {
  addBox,
  addMesh,
  addRod,
  addSlab,
  createCylinderGeometry,
  type Range,
} from '../util/geometry';
import type { WorkshopMaterials } from './materials';

const TRIM_HEIGHT = 0.06;
/** Back-left corner; the back-right is occupied by the shelving unit. */
const PANEL_X = -3.3;

/** The window opening in the left wall; also used by lighting to aim the daylight. */
export const WINDOW_OPENING = {
  z: [-2.2, 0.2] as Range,
  y: [2.0, 3.0] as Range,
};

interface WallSpec {
  name: string;
  x: Range;
  z: Range;
  /** Optional rectangular opening in a wall that runs along Z. */
  opening?: { z: Range; y: Range };
}

/** Floor, walls, ceiling, ceiling beams, the window and fixed wall hardware. */
export function createRoom(materials: WorkshopMaterials): Group {
  const room = new Group();
  room.name = 'room';

  const { halfWidth, halfDepth, height, wallThickness: t } = ROOM;
  const outerX = halfWidth + t;
  const outerZ = halfDepth + t;

  // The floor extends under the walls so there is never a gap at the base.
  addSlab(room, materials.concreteFloor, [-outerX, outerX], [-0.3, 0], [-outerZ, outerZ], {
    name: 'floor',
    castShadow: false,
  });
  addSlab(room, materials.ceiling, [-outerX, outerX], [height, height + t], [-outerZ, outerZ], {
    name: 'ceiling',
  });

  addWall(room, materials, { name: 'back-wall', x: [-outerX, outerX], z: [-outerZ, -halfDepth] });
  addWall(room, materials, { name: 'front-wall', x: [-outerX, outerX], z: [halfDepth, outerZ] });
  addWall(room, materials, { name: 'right-wall', x: [halfWidth, outerX], z: [-halfDepth, halfDepth] });
  addWall(room, materials, {
    name: 'left-wall',
    x: [-outerX, -halfWidth],
    z: [-halfDepth, halfDepth],
    opening: WINDOW_OPENING,
  });

  for (const z of [-2.3, 0.8, 3.1]) addIBeam(room, materials, z);

  addWindowFrame(room, materials);
  addElectricalPanel(room, materials);
  addFireExtinguisher(room, materials);

  return room;
}

/** Two-tone industrial wall: dark painted dado, a trim rail, lighter paint above. */
function addWall(room: Group, materials: WorkshopMaterials, spec: WallSpec): void {
  const { name, x, z, opening } = spec;
  const { dadoHeight, height } = ROOM;
  const upperStart = dadoHeight + TRIM_HEIGHT;

  addSlab(room, materials.wallDado, x, [0, dadoHeight], z, { name: `${name}-dado` });
  addSlab(room, materials.trim, x, [dadoHeight, upperStart], z, { name: `${name}-trim` });

  if (!opening) {
    addSlab(room, materials.wallUpper, x, [upperStart, height], z, { name: `${name}-upper` });
    return;
  }

  // Upper wall is assembled around the opening so the window is a real hole
  // (the daylight shadow map relies on that).
  const upper = materials.wallUpper;
  addSlab(room, upper, x, [upperStart, opening.y[0]], z, { name: `${name}-below-window` });
  addSlab(room, upper, x, [opening.y[1], height], z, { name: `${name}-above-window` });
  addSlab(room, upper, x, opening.y, [z[0], opening.z[0]], { name: `${name}-beside-window-a` });
  addSlab(room, upper, x, opening.y, [opening.z[1], z[1]], { name: `${name}-beside-window-b` });
}

function addIBeam(room: Group, materials: WorkshopMaterials, z: number): void {
  const span: Range = [-ROOM.halfWidth, ROOM.halfWidth];
  const top = ROOM.height;
  const bottom = top - 0.28;
  const name = `beam-${z}`;
  addSlab(room, materials.beam, span, [bottom, top], [z - 0.008, z + 0.008], { name: `${name}-web` });
  addSlab(room, materials.beam, span, [top - 0.02, top], [z - 0.08, z + 0.08], { name: `${name}-flange-top` });
  addSlab(room, materials.beam, span, [bottom, bottom + 0.02], [z - 0.08, z + 0.08], { name: `${name}-flange-bottom` });
}

function addWindowFrame(room: Group, materials: WorkshopMaterials): void {
  const frame = new Group();
  frame.name = 'window';
  room.add(frame);

  const [z0, z1] = WINDOW_OPENING.z;
  const [y0, y1] = WINDOW_OPENING.y;
  const x: Range = [-ROOM.halfWidth - 0.12, -ROOM.halfWidth - 0.04];
  const bar = 0.05;

  // Outer frame.
  addSlab(frame, materials.darkSteel, x, [y0, y0 + bar], [z0, z1], { name: 'sill' });
  addSlab(frame, materials.darkSteel, x, [y1 - bar, y1], [z0, z1], { name: 'head' });
  addSlab(frame, materials.darkSteel, x, [y0, y1], [z0, z0 + bar], { name: 'jamb-a' });
  addSlab(frame, materials.darkSteel, x, [y0, y1], [z1 - bar, z1], { name: 'jamb-b' });
  // Mullions: three panes across, two rows. These cast the barred daylight onto the floor.
  for (const z of [z0 + (z1 - z0) / 3, z0 + ((z1 - z0) * 2) / 3]) {
    addSlab(frame, materials.darkSteel, x, [y0, y1], [z - bar / 2, z + bar / 2], { name: 'mullion-vertical' });
  }
  const midY = (y0 + y1) / 2;
  addSlab(frame, materials.darkSteel, x, [midY - bar / 2, midY + bar / 2], [z0, z1], { name: 'mullion-horizontal' });

  // Overcast sky seen through the glass. It must not cast shadows or the daylight would be blocked.
  addSlab(frame, materials.windowGlow, [-ROOM.halfWidth - 0.2, -ROOM.halfWidth - 0.16], [y0, y1], [z0, z1], {
    name: 'sky',
    castShadow: false,
    receiveShadow: false,
  });
}

/** Breaker panel with a conduit run, mounted on the back wall. */
function addElectricalPanel(room: Group, materials: WorkshopMaterials): void {
  const wallZ = -ROOM.halfDepth;
  const panel = new Group();
  panel.name = 'electrical-panel';
  panel.position.set(PANEL_X, 1.85, wallZ + 0.07);
  room.add(panel);

  addBox(panel, materials.darkSteel, [0.46, 0.66, 0.1], [0, 0, 0], { name: 'panel-box' });
  addBox(panel, materials.shelfSteel, [0.4, 0.6, 0.02], [0, 0, 0.06], { name: 'panel-door' });
  addBox(panel, materials.rawSteel, [0.04, 0.1, 0.02], [0.14, 0, 0.08], { name: 'panel-latch' });

  const conduitZ = wallZ + 0.035;
  addRod(room, materials.rawSteel, [PANEL_X, 2.18, conduitZ], [PANEL_X, 3.05, conduitZ], 0.022, { name: 'conduit-riser' });
  addRod(room, materials.rawSteel, [PANEL_X, 3.05, conduitZ], [ROOM.halfWidth, 3.05, conduitZ], 0.022, { name: 'conduit-run' });
}

function addFireExtinguisher(room: Group, materials: WorkshopMaterials): void {
  const extinguisher = new Group();
  extinguisher.name = 'fire-extinguisher';
  // Right wall, toward the front of the room, so it catches a little light and adds a red accent.
  extinguisher.position.set(ROOM.halfWidth - 0.1, 0, 2.3);
  room.add(extinguisher);

  addMesh(extinguisher, createCylinderGeometry(0.075, 0.075, 0.42, 20), materials.labelRed, {
    name: 'extinguisher-body',
    position: [0, 1.0, 0],
  });
  addMesh(extinguisher, createCylinderGeometry(0.03, 0.05, 0.1, 16), materials.darkIron, {
    name: 'extinguisher-neck',
    position: [0, 1.26, 0],
  });
  addBox(extinguisher, materials.darkIron, [0.05, 0.03, 0.12], [-0.03, 1.33, 0], { name: 'extinguisher-handle' });
  addBox(extinguisher, materials.darkIron, [0.04, 0.5, 0.01], [0.085, 1.0, 0], { name: 'extinguisher-bracket' });
}
