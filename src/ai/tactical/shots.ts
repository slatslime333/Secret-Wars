import { listProjectilePoses, type ProjectilePose } from '../../combat/projectileRegistry';
import type { CombatantView, Personality, ProjectileThreat } from './types';

const lookAhead = (shot: ProjectilePose, seconds: number): { x: number; y: number } => ({
  x: shot.x + shot.vx * seconds,
  y: shot.y + shot.vy * seconds,
});

const closestApproach = (self: CombatantView, shot: ProjectilePose): { dist: number; eta: number } => {
  const speed = Math.hypot(shot.vx, shot.vy) || 1;
  const relX = self.x - shot.x;
  const relY = self.y - shot.y;
  const along = (relX * shot.vx + relY * shot.vy) / (speed * speed);
  const eta = Math.max(0, along);
  const future = lookAhead(shot, eta);
  const dist = Math.hypot(future.x - self.x, future.y - self.y);
  return { dist, eta: eta * 1000 };
};

export const scanProjectileThreat = (
  self: CombatantView,
  personality: Personality,
  bodyRadius = 16,
): ProjectileThreat | undefined => {
  const shots = listProjectilePoses();
  let best: ProjectileThreat | undefined;
  const reactWindow = 280 + personality.reactionQuality * 220 + personality.caution * 80;
  for (const shot of shots) {
    if (shot.team && shot.team === self.team) {
      continue;
    }
    const speed = Math.hypot(shot.vx, shot.vy);
    if (speed < 40) {
      continue;
    }
    const { dist, eta } = closestApproach(self, shot);
    const danger = shot.radius + bodyRadius + 10;
    if (eta > reactWindow || dist > danger + 28) {
      continue;
    }
    const willHit = dist <= danger + 6 && eta > 40;
    const threat: ProjectileThreat = {
      x: shot.x,
      y: shot.y,
      vx: shot.vx,
      vy: shot.vy,
      radius: shot.radius,
      eta,
      willHit,
    };
    if (!best || eta < best.eta) {
      best = threat;
    }
  }
  return best;
};

export const dodgeDirFor = (
  _self: CombatantView,
  threat: ProjectileThreat,
  side: number,
): { x: number; y: number } => {
  const speed = Math.hypot(threat.vx, threat.vy) || 1;
  const nx = threat.vx / speed;
  const ny = threat.vy / speed;
  const sx = -ny * side;
  const sy = nx * side;
  const retreat = -nx * 0.35 + sx;
  const retreatY = -ny * 0.35 + sy;
  const len = Math.hypot(retreat, retreatY) || 1;
  return { x: retreat / len, y: retreatY / len };
};
