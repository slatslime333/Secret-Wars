import { segmentHitsCircle } from '../geometry';
import { DEATH_SMASH } from './tunables';

/** Crash starts at this swing T, matching the bat pose in BatSmashAbility. */
const CRASH_SWING_T = 0.18;

const smashSpan = (): number => DEATH_SMASH.windupRad + DEATH_SMASH.followRad;

/** Radians relative to aim that the damaging crash covers. */
export const smashCrashOffsets = (): { from: number; to: number } => ({
  from: -DEATH_SMASH.windupRad + CRASH_SWING_T * smashSpan(),
  to: DEATH_SMASH.followRad,
});

/** Bat angle during the smash anim. `frac` is 0 at start, 1 at end. */
export const smashSwingAngle = (aimAngle: number, frac: number): number => {
  const start = aimAngle - DEATH_SMASH.windupRad;
  const end = aimAngle + DEATH_SMASH.followRad;
  const wind = frac < 0.56 ? frac / 0.56 : 1;
  const crash = frac >= 0.56 ? (frac - 0.56) / 0.44 : 0;
  const swingT = crash > 0 ? CRASH_SWING_T + crash * (1 - CRASH_SWING_T) : wind * CRASH_SWING_T;
  return start + (end - start) * swingT;
};

/** True when a circle overlaps the bat capsule at this swing angle. */
export const smashBatHits = (
  originX: number,
  originY: number,
  angle: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
): boolean => {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const start = 8;
  const ax = originX + dirX * start;
  const ay = originY + dirY * start;
  const bx = originX + dirX * DEATH_SMASH.radius;
  const by = originY + dirY * DEATH_SMASH.radius;
  return segmentHitsCircle(ax, ay, bx, by, targetX, targetY, DEATH_SMASH.halfWidth + targetRadius);
};

/** Forward bat at the given aim — used by aim guides and scenario checks. */
export const smashHitsTarget = (
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
): boolean => smashBatHits(originX, originY, Math.atan2(dirY, dirX), targetX, targetY, targetRadius);
