import { Group, HemisphereLight, MeshStandardMaterial, SphereGeometry, SpotLight } from 'three';
import { LAYOUT, PALETTE, ROOM } from '../config';
import { addMesh, addRod, createCylinderGeometry, type Vec3 } from '../util/geometry';
import type { WorkshopMaterials } from './materials';
import { WINDOW_OPENING } from './room';

export interface Lighting {
  readonly group: Group;
  update(elapsedSeconds: number): void;
}

/** Height of the ceiling beams' underside, where pendant fixtures are hung. */
const BEAM_UNDERSIDE = ROOM.height - 0.28;

/**
 * The lighting rig. Palette: warm amber practical lights against cool,
 * dim ambient and a cool shaft of daylight from the high window.
 *
 * Only three lights cast shadows (daylight, one pendant, the arcade key);
 * every shadow-casting light re-renders the scene once per frame.
 */
export function createLighting(materials: WorkshopMaterials): Lighting {
  const group = new Group();
  group.name = 'lighting';

  // Cool, dim base fill so shadows read blue-ish instead of black.
  group.add(new HemisphereLight(0x5b6e86, 0x2a231f, 0.3));

  addDaylight(group);
  addArcadeKeyLight(group);

  addPendant(group, materials, { position: [-1.5, BEAM_UNDERSIDE, -2.3], intensity: 46, castShadow: true });
  // Dead fixture: housing and bulb only. Part of the "abandoned" story.
  addPendant(group, materials, { position: [1.9, BEAM_UNDERSIDE, -2.3], intensity: 0 });

  const flickering = addPendant(group, materials, {
    position: [0.3, BEAM_UNDERSIDE, 0.8],
    intensity: 34,
    ownBulbMaterial: true,
  });

  return {
    group,
    update(elapsedSeconds) {
      if (!flickering.light || !flickering.bulbMaterial) return;
      const level = flickerLevel(elapsedSeconds);
      flickering.light.intensity = flickering.baseIntensity * level;
      flickering.bulbMaterial.emissiveIntensity = flickering.baseEmissive * level;
    },
  };
}

/** Overcast skylight entering through the high window, cut into bars by the window frame. */
function addDaylight(group: Group): void {
  const windowCenter: Vec3 = [
    -ROOM.halfWidth,
    (WINDOW_OPENING.y[0] + WINDOW_OPENING.y[1]) / 2,
    (WINDOW_OPENING.z[0] + WINDOW_OPENING.z[1]) / 2,
  ];

  const light = new SpotLight(PALETTE.coolLight, 340, 0, 0.3, 0.25, 2);
  // Far outside and high so the window shadow lands mid-floor, not on the wall.
  light.position.set(windowCenter[0] - 6, windowCenter[1] + 4.5, windowCenter[2]);
  light.target.position.set(...windowCenter);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 4;
  light.shadow.camera.far = 22;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.03;
  light.shadow.radius = 3;
  group.add(light, light.target);
}

/** Warm spot that picks the arcade cabinet out as the focal point. */
function addArcadeKeyLight(group: Group): void {
  const [x, , z] = LAYOUT.arcade.position;
  const light = new SpotLight(PALETTE.amberHot, 95, 0, 0.5, 0.75, 2);
  light.position.set(x + 0.9, 3.3, z + 2.1);
  light.target.position.set(x, 1.0, z + 0.1);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 8;
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.02;
  light.shadow.radius = 3;
  group.add(light, light.target);
}

interface PendantOptions {
  position: Vec3;
  /** Candela. Zero builds a dead fixture with no light. */
  intensity: number;
  castShadow?: boolean;
  /** Clone the bulb material so this fixture can flicker independently. */
  ownBulbMaterial?: boolean;
}

interface PendantHandle {
  light: SpotLight | null;
  bulbMaterial: MeshStandardMaterial | null;
  baseIntensity: number;
  baseEmissive: number;
}

function addPendant(group: Group, materials: WorkshopMaterials, options: PendantOptions): PendantHandle {
  const fixture = new Group();
  fixture.name = 'pendant';
  fixture.position.set(...options.position);
  group.add(fixture);

  const lit = options.intensity > 0;
  const bulbMaterial = lit
    ? options.ownBulbMaterial
      ? materials.bulbOn.clone()
      : materials.bulbOn
    : materials.bulbOff;

  const chainLength = 0.55;
  addRod(fixture, materials.darkIron, [0, 0, 0], [0, -chainLength, 0], 0.008, {
    name: 'pendant-chain',
    castShadow: false,
  });
  // Shade and bulb never cast shadows: the light sits inside the shade and would be blocked by it.
  addMesh(fixture, createCylinderGeometry(0.06, 0.3, 0.22, 28, true), materials.enamelShade, {
    name: 'pendant-shade',
    position: [0, -chainLength - 0.11, 0],
    castShadow: false,
  });
  addMesh(fixture, new SphereGeometry(0.06, 16, 12), bulbMaterial, {
    name: 'pendant-bulb',
    position: [0, -chainLength - 0.15, 0],
    castShadow: false,
  });

  let light: SpotLight | null = null;
  if (lit) {
    light = new SpotLight(PALETTE.amberLight, options.intensity, 0, 1.05, 0.85, 2);
    light.position.set(0, -chainLength - 0.17, 0);
    light.target.position.set(0, -4, 0);
    light.castShadow = options.castShadow ?? false;
    if (light.castShadow) {
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.3;
      light.shadow.camera.far = 9;
      light.shadow.bias = -0.0005;
      light.shadow.normalBias = 0.025;
      light.shadow.radius = 4;
    }
    fixture.add(light, light.target);
  }

  return {
    light,
    bulbMaterial: lit ? bulbMaterial : null,
    baseIntensity: options.intensity,
    baseEmissive: bulbMaterial.emissiveIntensity,
  };
}

/** Mostly steady with a faint waver and a brief stutter every ~9 seconds. */
function flickerLevel(seconds: number): number {
  const waver = 0.97 + 0.03 * Math.sin(seconds * 1.3);
  const sinceStutter = seconds % 9.3;
  const stutter = sinceStutter < 0.16 ? 0.5 + 0.5 * Math.abs(Math.sin(sinceStutter * 55)) : 1;
  return waver * stutter;
}
