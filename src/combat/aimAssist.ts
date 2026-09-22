import { INPUT } from '../config/input';

type AimPoint = { x: number; y: number };
type AimTarget = AimPoint & { down?: boolean };

/**
 * A small nudge toward a target already inside the aim cone.
 * It never snaps. If nothing is close to the stick, the aim is unchanged.
 */
export const softenAim = (
  aim: AimPoint,
  origin: AimPoint,
  targets: AimTarget[],
  range: number,
): AimPoint => {
  const len = Math.hypot(aim.x, aim.y);
  if (len < 0.2) {
    return aim;
  }
  const ax = aim.x / len;
  const ay = aim.y / len;
  const maxRange = Math.max(48, range * INPUT.aimAssistRangeMul);
  let best = 0;
  let bestX = ax;
  let bestY = ay;
  for (const target of targets) {
    if (target.down) {
      continue;
    }
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12 || dist > maxRange) {
      continue;
    }
    const tx = dx / dist;
    const ty = dy / dist;
    const dot = Math.min(1, Math.max(-1, tx * ax + ty * ay));
    const angle = Math.acos(dot);
    if (angle > INPUT.aimAssistConeRad) {
      continue;
    }
    const score = (1 - angle / INPUT.aimAssistConeRad) * (1 - dist / maxRange);
    if (score <= best) {
      continue;
    }
    best = score;
    const blend = INPUT.aimAssistPull * (1 - angle / INPUT.aimAssistConeRad);
    const x = ax + (tx - ax) * blend;
    const y = ay + (ty - ay) * blend;
    const next = Math.hypot(x, y) || 1;
    bestX = x / next;
    bestY = y / next;
  }
  return { x: bestX, y: bestY };
};
