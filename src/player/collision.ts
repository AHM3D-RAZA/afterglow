import type { Rect } from '../util/rect';

/** A position on the floor plane. Mutated in place to avoid per-frame allocation. */
export interface FloorPoint {
  x: number;
  z: number;
}

/** How far into an obstacle (meters) still counts as touching rather than inside it. */
const TOUCH_TOLERANCE = 1e-4;

/**
 * Moves a circle by (dx, dz), sliding along room walls and obstacles.
 *
 * The circle is pushed out of every rectangle it overlaps and back inside the
 * room bounds, so it glides along surfaces instead of stopping dead. If that
 * cannot produce a legal position (a gap narrower than the player between a
 * wall and a crate, say), the move is cancelled: the player is never left
 * overlapping something.
 */
export function moveWithCollisions(
  point: FloorPoint,
  dx: number,
  dz: number,
  radius: number,
  bounds: Rect,
  obstacles: readonly Rect[],
): void {
  const startX = point.x;
  const startZ = point.z;
  point.x += dx;
  point.z += dz;

  // Two passes: leaving one obstacle can nudge the circle into a neighbour
  // (the corner between two crates), and the second pass settles that.
  for (let pass = 0; pass < 2; pass++) {
    for (const obstacle of obstacles) pushOutOfRect(point, radius, obstacle);
    point.x = clamp(point.x, bounds.minX + radius, bounds.maxX - radius);
    point.z = clamp(point.z, bounds.minZ + radius, bounds.maxZ - radius);
  }

  if (overlapsAny(point, radius - TOUCH_TOLERANCE, obstacles)) {
    point.x = startX;
    point.z = startZ;
  }
}

/** True if a circle at `point` overlaps any obstacle. Used to validate spawn positions. */
export function overlapsAny(point: FloorPoint, radius: number, obstacles: readonly Rect[]): boolean {
  return obstacles.some((rect) => {
    const dx = point.x - clamp(point.x, rect.minX, rect.maxX);
    const dz = point.z - clamp(point.z, rect.minZ, rect.maxZ);
    return dx * dx + dz * dz < radius * radius;
  });
}

function pushOutOfRect(point: FloorPoint, radius: number, rect: Rect): void {
  const nearestX = clamp(point.x, rect.minX, rect.maxX);
  const nearestZ = clamp(point.z, rect.minZ, rect.maxZ);
  const dx = point.x - nearestX;
  const dz = point.z - nearestZ;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= radius * radius) return;

  if (distanceSquared > 1e-12) {
    // Outside the rectangle but too close: move away along the line from its nearest point.
    const distance = Math.sqrt(distanceSquared);
    const push = (radius - distance) / distance;
    point.x += dx * push;
    point.z += dz * push;
    return;
  }

  // The center is inside the rectangle (a very large step): leave through the nearest side.
  const toMinX = point.x - rect.minX;
  const toMaxX = rect.maxX - point.x;
  const toMinZ = point.z - rect.minZ;
  const toMaxZ = rect.maxZ - point.z;
  const nearest = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
  if (nearest === toMinX) point.x = rect.minX - radius;
  else if (nearest === toMaxX) point.x = rect.maxX + radius;
  else if (nearest === toMinZ) point.z = rect.minZ - radius;
  else point.z = rect.maxZ + radius;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
