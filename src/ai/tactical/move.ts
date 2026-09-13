import { ARENA, atFarEdge, nearestLane, pushLimitX, roamHuntPoint } from '../../config/arena';
import type { TacticalAction } from './types';

export type MoveSample = {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  halt: boolean;
};

export type MoveBody = {
  x: number;
  y: number;
  team: 'alpha' | 'bravo';
  attackRange: number;
  role: string;
  kind: 'hero' | 'minion';
};

export type MoveFocus = {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
};

const preferredRange = (body: MoveBody, action: TacticalAction): number => {
  const ranged = body.role === 'ranged' || (body.kind === 'minion' && body.attackRange > 80);
  const wait = action === 'wait_for_opening' || action === 'hold_position';
  if (wait) {
    return body.attackRange * (ranged ? 0.92 : 1.14);
  }
  if (action === 'reposition' && ranged) {
    return body.attackRange * 0.88;
  }
  return body.attackRange * (ranged ? 0.78 : 0.7);
};

const laneYOf = (y: number): number => ARENA.laneY[nearestLane(y)];

/**
 * Turn a committed action into a walk point. Physics/steering stay on the body.
 */
export const moveGoal = (
  action: TacticalAction,
  body: MoveBody,
  now: number,
  homeX: number,
  homeY: number,
  target?: MoveFocus,
  ally?: MoveFocus,
  flankSign = 1,
  slot = 0,
  retreatGoal?: { x: number; y: number },
): MoveSample => {
  const aimTo = (x: number, y: number): { aimX: number; aimY: number } => {
    const len = Math.hypot(x - body.x, y - body.y) || 1;
    return { aimX: (x - body.x) / len, aimY: (y - body.y) / len };
  };

  if (action === 'retreat' || action === 'escape' || action === 'recover') {
    const destX = retreatGoal?.x ?? homeX;
    const destY = retreatGoal?.y ?? homeY;
    const gap = Math.hypot(destX - body.x, destY - body.y);
    const aim = target ? aimTo(target.x, target.y) : aimTo(destX, destY);
    const halt = action === 'recover' && gap < 40;
    return {
      x: destX,
      y: destY,
      halt,
      aimX: target ? -aim.aimX : aim.aimX,
      aimY: target ? -aim.aimY : aim.aimY,
    };
  }

  if (!target) {
    if (atFarEdge(body.team, body.x)) {
      const hunt = roamHuntPoint(body.team, body.y, Math.floor(now / 1800) + slot);
      const gap = Math.hypot(hunt.x - body.x, hunt.y - body.y);
      const aim = aimTo(hunt.x, hunt.y);
      return { x: hunt.x, y: hunt.y, halt: gap < 52, ...aim };
    }
    const destX = pushLimitX(body.team);
    const destY = laneYOf(body.y);
    const gap = Math.hypot(destX - body.x, destY - body.y);
    const aim = aimTo(destX, destY);
    return { x: destX, y: destY, halt: gap < 36, ...aim };
  }

  const range = preferredRange(body, action);
  const toX = target.x - body.x;
  const toY = target.y - body.y;
  const gap = Math.hypot(toX, toY) || 1;

  if (action === 'wait_for_opening' || action === 'hold_position') {
    const t = now * 0.0032 + slot * 1.7;
    const radius = range + 18;
    const gx = target.x + Math.cos(t) * radius;
    const gy = target.y + Math.sin(t) * radius;
    const aim = aimTo(target.x, target.y);
    const halt = action === 'hold_position' && Math.abs(gap - range) < 22;
    return { x: gx, y: gy, halt, ...aim };
  }

  if (action === 'flank') {
    const src = ally ?? { x: body.x, y: body.y, aimX: 1, aimY: 0 };
    let fx = target.x - src.x;
    let fy = target.y - src.y;
    const flen = Math.hypot(fx, fy) || 1;
    fx /= flen;
    fy /= flen;
    const gx = target.x - fx * range * 0.55 + -fy * range * 0.9 * flankSign;
    const gy = target.y - fy * range * 0.55 + fx * range * 0.9 * flankSign;
    const aim = aimTo(target.x, target.y);
    return { x: gx, y: gy, halt: false, ...aim };
  }

  if (action === 'reposition') {
    const side = flankSign >= 0 ? 1 : -1;
    const nx = toX / gap;
    const ny = toY / gap;
    const gx = target.x - nx * range + -ny * 46 * side;
    const gy = target.y - ny * range + nx * 46 * side;
    const aim = aimTo(target.x, target.y);
    return { x: gx, y: gy, halt: false, ...aim };
  }

  if (action === 'protect_ally' && ally) {
    const gx = ally.x + (ally.x - target.x) * 0.15;
    const gy = ally.y + (ally.y - target.y) * 0.15;
    const aim = aimTo(target.x, target.y);
    return { x: gx, y: gy, halt: false, ...aim };
  }

  if (action === 'intercept') {
    const gx = target.x + target.aimX * 36;
    const gy = target.y + target.aimY * 36;
    const aim = aimTo(gx, gy);
    return { x: gx, y: gy, halt: false, ...aim };
  }

  const nx = toX / gap;
  const ny = toY / gap;
  if (gap < range - 20 && action !== 'chase' && action !== 'finish_target') {
    return { x: body.x, y: body.y, halt: true, aimX: nx, aimY: ny };
  }
  const gx = target.x - nx * range * 0.62;
  const gy = target.y - ny * range * 0.62;
  return { x: gx, y: gy, halt: false, aimX: nx, aimY: ny };
};
