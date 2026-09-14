import type { NinjaBody } from '../../NinjaBody';

export const nearestAllyHero = (caster: NinjaBody, allies: NinjaBody[], range: number): NinjaBody | undefined => {
  let best: NinjaBody | undefined;
  let bestDist = range;
  for (const ally of allies) {
    if (ally === caster || ally.down || !ally.isPresent || ally.stats.role === 'minion') {
      continue;
    }
    const dist = Math.hypot(ally.x - caster.x, ally.y - caster.y);
    if (dist <= bestDist) {
      best = ally;
      bestDist = dist;
    }
  }
  return best;
};

/** Ally closest to the aim ray, still inside `range`. */
export const allyAlongAim = (
  caster: NinjaBody,
  allies: NinjaBody[],
  range: number,
  aimX: number,
  aimY: number,
): NinjaBody | undefined => {
  const len = Math.hypot(aimX, aimY) || 1;
  const nx = aimX / len;
  const ny = aimY / len;
  let best: NinjaBody | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const ally of allies) {
    if (ally === caster || ally.down || !ally.isPresent || ally.stats.role === 'minion') {
      continue;
    }
    const dx = ally.x - caster.x;
    const dy = ally.y - caster.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 8) {
      continue;
    }
    const along = dx * nx + dy * ny;
    if (along < 10) {
      continue;
    }
    const side = Math.abs(dx * ny - dy * nx);
    if (side > 70 && side / Math.max(1, along) > 0.55) {
      continue;
    }
    const score = side * 1.4 + dist;
    if (score < bestScore) {
      best = ally;
      bestScore = score;
    }
  }
  return best ?? nearestAllyHero(caster, allies, range);
};
