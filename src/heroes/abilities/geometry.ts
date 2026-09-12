/** Closest point on segment AB to P. */
export const closestPointOnSegment = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): { x: number; y: number; t: number } => {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq < 0.0001) {
    return { x: ax, y: ay, t: 0 };
  }
  const t = Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  return { x: ax + abx * t, y: ay + aby * t, t };
};

/** True when a circle overlaps the thick segment (capsule) from A to B. */
export const segmentHitsCircle = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number,
): boolean => {
  const closest = closestPointOnSegment(ax, ay, bx, by, cx, cy);
  return Math.hypot(cx - closest.x, cy - closest.y) <= radius;
};

export const distanceBetween = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(bx - ax, by - ay);
