import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  LatheGeometry,
  Mesh,
  type Material,
  type Object3D,
  Vector2,
  Vector3,
} from 'three';

/**
 * Geometry helpers for the procedural workshop.
 *
 * Convention: UV coordinates are expressed in METERS. A texture then repeats
 * every `tileMeters` (set on the texture), so every surface in the scene shares
 * one physical texel density no matter how big or small the mesh is.
 */

export type Vec3 = readonly [number, number, number];
/** A [min, max] extent along one axis. */
export type Range = readonly [number, number];

export interface MeshOptions {
  name?: string;
  position?: Vec3;
  /** Euler rotation in radians (XYZ order). */
  rotation?: Vec3;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Box geometry centered on its own origin, with UVs projected per face in
 * meters from the box's position in its parent (`center`). Projecting from the
 * parent-space position keeps textures continuous across adjacent slabs, while
 * the mesh itself stays centered so it can be rotated about its middle.
 * Callers place the mesh at `center`; prefer `addBox` / `addSlab`.
 */
export function createBoxGeometry(size: Vec3, center: Vec3 = [0, 0, 0]): BoxGeometry {
  const geometry = new BoxGeometry(size[0], size[1], size[2]);

  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + center[0];
    const y = position.getY(i) + center[1];
    const z = position.getZ(i) + center[2];
    const ax = Math.abs(normal.getX(i));
    const ay = Math.abs(normal.getY(i));
    const az = Math.abs(normal.getZ(i));
    if (ax > ay && ax > az) uv.setXY(i, z, y);
    else if (ay > az) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  return geometry;
}

/** Cylinder (or cone) with UVs in meters: u wraps the circumference, v runs along the height. */
export function createCylinderGeometry(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments = 24,
  openEnded = false,
): CylinderGeometry {
  const geometry = new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, openEnded);
  scaleUvs(geometry, Math.PI * 2 * Math.max(radiusTop, radiusBottom), height);
  return geometry;
}

/** Lathe surface (buckets, bowls, cans) with UVs in meters. `profile` is [radius, height] pairs. */
export function createLatheGeometry(
  profile: ReadonlyArray<readonly [number, number]>,
  radialSegments = 28,
): LatheGeometry {
  const points = profile.map(([radius, height]) => new Vector2(radius, height));
  const geometry = new LatheGeometry(points, radialSegments);
  const maxRadius = Math.max(...profile.map(([radius]) => radius));
  let profileLength = 0;
  for (let i = 1; i < points.length; i++) {
    profileLength += points[i].distanceTo(points[i - 1]);
  }
  scaleUvs(geometry, Math.PI * 2 * maxRadius, profileLength);
  return geometry;
}

/** Multiplies a geometry's UVs, e.g. to convert 0..1 UVs into meters. */
export function scaleUvs(geometry: BufferGeometry, u: number, v: number): void {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  }
}

export function addMesh(
  parent: Object3D,
  geometry: BufferGeometry,
  material: Material,
  options: MeshOptions = {},
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.name) mesh.name = options.name;
  if (options.position) mesh.position.set(...options.position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

/**
 * Adds a box of `size` centered on `center` (in the parent's local space).
 * Rotation in `options` pivots about the box's own center.
 */
export function addBox(
  parent: Object3D,
  material: Material,
  size: Vec3,
  center: Vec3,
  options: Omit<MeshOptions, 'position'> = {},
): Mesh {
  const mesh = addMesh(parent, createBoxGeometry(size, center), material, options);
  mesh.position.set(...center);
  return mesh;
}

/** Adds a box spanning the given axis-aligned extents. Handy for walls and slabs. */
export function addSlab(
  parent: Object3D,
  material: Material,
  x: Range,
  y: Range,
  z: Range,
  options: Omit<MeshOptions, 'position'> = {},
): Mesh {
  return addBox(
    parent,
    material,
    [x[1] - x[0], y[1] - y[0], z[1] - z[0]],
    [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2],
    options,
  );
}

/** Adds a round rod running from `start` to `end`. */
export function addRod(
  parent: Object3D,
  material: Material,
  start: Vec3,
  end: Vec3,
  radius: number,
  options: MeshOptions = {},
): Mesh {
  const from = new Vector3(...start);
  const to = new Vector3(...end);
  const direction = to.clone().sub(from);
  const length = direction.length();
  const mesh = addMesh(parent, createCylinderGeometry(radius, radius, length, 12), material, options);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

/** Euler rotation that lays a Y-axis cylinder down along the X axis. */
export const LAY_ALONG_X: Vec3 = [0, 0, Math.PI / 2];
/** Euler rotation that lays a Y-axis cylinder down along the Z axis. */
export const LAY_ALONG_Z: Vec3 = [Math.PI / 2, 0, 0];
