import { segmentHitsCircle } from '../geometry';
import { DEATH_SMASH } from './tunables';

/** Forward bat capsule from Death toward aim. Matches the smash telegraph. */
export const smashHitsTarget = (
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
): boolean => {
  const start = 8;
  const ax = originX + dirX * start;
  const ay = originY + dirY * start;
  const bx = originX + dirX * DEATH_SMASH.radius;
  const by = originY + dirY * DEATH_SMASH.radius;
  return segmentHitsCircle(ax, ay, bx, by, targetX, targetY, DEATH_SMASH.halfWidth + targetRadius);
};
