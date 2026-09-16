/**
 * Environmental size is derived from live hero art, not guessed.
 *
 * Ninja / Cole sprites occupy roughly 22×46 px (hood tip to boot, plus
 * ground shadow). Body radius is 14. Minions are radius 9.
 *
 * Crates should read as chest-high supply boxes. Barricades should hide a
 * person. Vehicles should dwarf a hero. Buildings should look enterable
 * without swallowing the compact 3v3 field.
 */
export const HERO_VISUAL = {
  width: 22,
  height: 46,
  radius: 14,
} as const;

export type PropSpec = {
  /** Collision AABB. */
  w: number;
  h: number;
  /** Visual size. May extend past collision (canopies, cabins). */
  vw: number;
  vh: number;
  /** Shift visual up so feet/tires sit on the collision box. */
  lift: number;
};

const spec = (w: number, h: number, vw = w, vh = h, lift = 0): PropSpec => ({ w, h, vw, vh, lift });

export const PROP = {
  crate: spec(36, 32, 40, 36, 2),
  crateStack: spec(38, 44, 42, 52, 4),
  cratePair: spec(72, 32, 78, 36, 2),
  barricade: spec(78, 24, 82, 30, 3),
  sandbag: spec(64, 22, 68, 26, 2),
  fence: spec(88, 12, 92, 34, 10),
  wallStone: spec(120, 22, 124, 28, 3),
  wallRuin: spec(86, 22, 90, 30, 4),
  wallWood: spec(96, 20, 100, 26, 3),
  treeSmall: spec(16, 16, 48, 56, 18),
  treeMedium: spec(18, 18, 56, 66, 22),
  treeBroad: spec(20, 18, 64, 60, 20),
  rubble: spec(52, 36, 58, 42, 3),
  rubbleSmall: spec(28, 20, 32, 24, 2),
  car: spec(108, 50, 118, 62, 5),
  truck: spec(140, 62, 156, 74, 6),
  /** Collision is the remaining south wall; the ruin visual is taller and walkable. */
  building: spec(100, 26, 120, 108, 36),
  buildingWall: spec(108, 22, 112, 28, 3),
  buildingStub: spec(22, 64, 28, 72, 4),
  sign: spec(10, 12, 18, 40, 14),
  barrel: spec(22, 28, 26, 34, 3),
} as const;

export const ROAD = {
  width: 82,
  sidewalk: 20,
  curb: 4,
  segment: 156,
  pothole: 18,
} as const;

export const visualForProp = (
  spec: PropSpec,
  cx: number,
  cy: number,
): { x: number; y: number; w: number; h: number } => ({
  x: cx - spec.vw / 2,
  y: cy - spec.vh / 2 - spec.lift,
  w: spec.vw,
  h: spec.vh,
});
