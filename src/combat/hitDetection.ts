/**
 * Melee hit test: target is in range and inside the aimed wedge.
 * Pure math so combat can be tuned without opening Phaser scenes.
 */
export const isInAttackArc = (
  originX: number,
  originY: number,
  aimX: number,
  aimY: number,
  targetX: number,
  targetY: number,
  range: number,
  halfArcRad: number,
  targetRadius: number,
): boolean => {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const distance = Math.hypot(dx, dy);
  if (distance > range + targetRadius) {
    return false;
  }
  if (distance < 1) {
    return true;
  }

  const aimLength = Math.hypot(aimX, aimY);
  if (aimLength < 0.001) {
    return distance <= range + targetRadius;
  }

  const dot = (dx * aimX + dy * aimY) / (distance * aimLength);
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  return angle <= halfArcRad;
};
