import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { ROOM } from '../config';
import { createSurfaceTextures, type SurfaceRecipe } from '../procedural/surfaces';
import { addBox } from '../util/geometry';
import { addDirtLayer, type CleanableSurface } from './dirtLayer';
import type { WorkshopMaterials } from './materials';

/** Face size in meters. Big enough to judge cleaning patterns up close and from across the room. */
const FACE_SIZE = [1.5, 1.1] as const;
const FRAME = 0.05;
/** Center of the panel: on the right wall, clear of the drums and tires, out of the opening view. */
const CENTER = [ROOM.halfWidth - 0.05, 1.35, -0.45] as const;

/**
 * The dirty test panel: enameled steel under a layer of grime that can be
 * sprayed off. The clean paint is an ordinary procedural surface; the dirt
 * is added by `addDirtLayer` and removed through the panel's mask.
 */
export function createTestPanel(materials: WorkshopMaterials): { group: Group; surface: CleanableSurface } {
  const group = new Group();
  group.name = 'test-panel';
  group.position.set(...CENTER);
  group.rotation.y = -Math.PI / 2; // face the room (-X)

  const [width, height] = FACE_SIZE;

  const { map, detailMap } = createSurfaceTextures(enamelRecipe(width));
  // The face has 0..1 UVs, so the texture repeat is set here instead of from meters.
  for (const texture of [map, detailMap]) {
    texture.repeat.set(1, height / width);
    texture.offset.set(0, 1 - height / width); // keep the top of the artwork on the top edge
  }

  const material = new MeshStandardMaterial({
    map,
    roughnessMap: detailMap,
    bumpMap: detailMap,
    bumpScale: 1,
    roughness: 1,
    metalness: 0.3,
  });
  const face = new Mesh(new PlaneGeometry(width, height), material);
  face.name = 'test-panel-face';
  face.receiveShadow = true;
  group.add(face);

  const surface: CleanableSurface = {
    name: 'test-panel',
    mesh: face,
    sizeMeters: FACE_SIZE,
    mask: { value: null },
  };
  addDirtLayer(material, surface);

  addFrame(group, materials, width, height);
  return { group, surface };
}

/** Fixed bar around the face, plus a back plate that closes the gap to the wall. */
function addFrame(group: Group, materials: WorkshopMaterials, width: number, height: number): void {
  const depth = 0.07;
  const z = -0.01;
  const outerWidth = width + FRAME * 2;
  addBox(group, materials.darkSteel, [outerWidth, FRAME, depth], [0, height / 2 + FRAME / 2, z], { name: 'frame-top' });
  addBox(group, materials.darkSteel, [outerWidth, FRAME, depth], [0, -height / 2 - FRAME / 2, z], { name: 'frame-bottom' });
  addBox(group, materials.darkSteel, [FRAME, height, depth], [-width / 2 - FRAME / 2, 0, z], { name: 'frame-left' });
  addBox(group, materials.darkSteel, [FRAME, height, depth], [width / 2 + FRAME / 2, 0, z], { name: 'frame-right' });
  addBox(group, materials.darkIron, [outerWidth, height + FRAME * 2, 0.03], [0, 0, -0.03], { name: 'panel-back' });
}

/** Clean enamel: a muted blue-green paint with a cream stripe, seams, rivets and a few chips. */
function enamelRecipe(widthMeters: number): SurfaceRecipe {
  return {
    seed: 8101,
    resolution: 512,
    tileMeters: widthMeters,
    baseColor: [88, 142, 154],
    mottleColor: [106, 162, 172],
    grimeColor: [40, 62, 68],
    grimeCoverage: 0.06,
    grain: 0.14,
    roughness: [0.28, 0.5],
    details(d) {
      const meters = (value: number): number => value * d.pixelsPerMeter;
      const mm = (value: number): number => Math.max(0.9, meters(value / 1000));

      // Cream stripe across the face.
      d.fillPath(
        (ctx) => ctx.rect(0, meters(0.5), d.size, meters(0.085)),
        { color: 'rgb(190,180,150)', value: 0.55 },
      );
      // Panel seams: a dark groove with a pale lip below it.
      for (const y of [0.37, 0.74]) {
        d.strokePath(
          (ctx) => {
            ctx.moveTo(0, meters(y));
            ctx.lineTo(d.size, meters(y));
          },
          { color: 'rgb(22,34,38)', value: 0.1, alpha: 0.9 },
          mm(3),
        );
        d.strokePath(
          (ctx) => {
            ctx.moveTo(0, meters(y) + mm(4));
            ctx.lineTo(d.size, meters(y) + mm(4));
          },
          { color: 'rgb(118,160,168)', value: 0.8, alpha: 0.5 },
          mm(1.5),
        );
      }
      // Rivets along the top and bottom edges.
      for (let x = 0.1; x < 1.5; x += 0.2) {
        for (const y of [0.05, 1.05]) {
          d.fillPath((ctx) => ctx.arc(meters(x), meters(y), mm(4), 0, Math.PI * 2), {
            color: 'rgb(46,66,72)',
            value: 0.9,
          });
        }
      }
      // A few chips down to primer.
      for (let i = 0; i < 26; i++) {
        const x = d.rng() * d.size;
        const y = d.rng() * meters(1.1);
        const radius = mm(1 + d.rng() * 3);
        d.fillPath((ctx) => ctx.arc(x, y, radius, 0, Math.PI * 2), { color: 'rgb(104,96,88)', value: 0.85 });
      }
    },
  };
}
