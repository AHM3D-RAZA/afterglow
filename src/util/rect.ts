/** Axis-aligned rectangle on the floor plane (x, z), in meters. */
export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}
