import { ARENA, atFarEdge, nearestLane, roamHuntPoint } from '../../config/arena';
import type { ObjectiveKind } from '../../config/objective';
import type { KitStance, TacticalAction } from './types';

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

export type MoveHint = {
  stance?: KitStance;
  preferredRange?: number;
  anchorX?: number;
  anchorY?: number;
  objective?: {
    kind: ObjectiveKind;
    x: number;
    y: number;
    radius: number;
  };
};

const isRangedMove = (body: MoveBody, hint?: MoveHint): boolean => {
  if (hint?.stance) {
    return hint.stance === 'ranged' || hint.stance === 'support';
  }
  return body.role === 'ranged' || body.role === 'ranged-tank' || body.role === 'support' || (body.kind === 'minion' && body.attackRange > 80);
};

const preferredRange = (body: MoveBody, action: TacticalAction, hint?: MoveHint): number => {
  const ranged = isRangedMove(body, hint);
  const base = hint?.preferredRange ?? body.attackRange * (ranged ? 0.88 : 0.7);
  const wait = action === 'wait_for_opening' || action === 'hold_position';
  if (wait) {
    return body.attackRange * (ranged ? 0.92 : 1.14);
  }
  if (action === 'reposition' && ranged) {
    return Math.max(base, body.attackRange * 0.88);
  }
  return ranged ? base : body.attackRange * 0.7;
};

const laneYOf = (y: number): number => ARENA.laneY[nearestLane(y)];

const idleAnchor = (body: MoveBody, now: number, slot: number, hint?: MoveHint): { x: number; y: number } => {
  if (hint?.anchorX !== undefined && hint.anchorY !== undefined) {
    return { x: hint.anchorX, y: hint.anchorY };
  }
  if (atFarEdge(body.team, body.x)) {
    return roamHuntPoint(body.team, body.y, Math.floor(now / 1800) + slot);
  }
  const mid = ARENA.width / 2;
  const own = body.team === 'alpha' ? mid - 220 : mid + 220;
  return { x: own, y: laneYOf(body.y) };
};

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
  hint?: MoveHint,
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

  if (action === 'regroup') {
    const dest = ally
      ? {
          x: ally.x + (hint?.stance === 'ranged' || hint?.stance === 'support' ? (body.team === 'alpha' ? -70 : 70) : body.team === 'alpha' ? 36 : -36),
          y: ally.y + 28 * flankSign,
        }
      : idleAnchor(body, now, slot, hint);
    const gap = Math.hypot(dest.x - body.x, dest.y - body.y);
    const aim = target ? aimTo(target.x, target.y) : aimTo(dest.x, dest.y);
    return { x: dest.x, y: dest.y, halt: gap < 28, ...aim };
  }

  if (action === 'contest_objective' && hint?.objective) {
    const obj = hint.objective;
    const ranged = isRangedMove(body, hint);
    const support = hint.stance === 'support';
    const aim = target ? aimTo(target.x, target.y) : aimTo(obj.x, obj.y);
    if (obj.kind === 'capture_zone') {
      if (ranged) {
        const gx = obj.x + -flankSign * obj.radius * 0.72;
        const gy = obj.y + (slot % 2 === 0 ? 1 : -1) * obj.radius * 0.28;
        const gap = Math.hypot(gx - body.x, gy - body.y);
        return { x: gx, y: gy, halt: gap < 28, ...aim };
      }
      if (support && ally) {
        const gx = ally.x * 0.65 + obj.x * 0.35;
        const gy = ally.y * 0.65 + obj.y * 0.35;
        const gap = Math.hypot(gx - body.x, gy - body.y);
        return { x: gx, y: gy, halt: gap < 24, ...aim };
      }
      const offset = 18 * flankSign;
      const gx = obj.x + (ranged ? 0 : offset * 0.4);
      const gy = obj.y + offset;
      const gap = Math.hypot(gx - body.x, gy - body.y);
      return { x: gx, y: gy, halt: gap < obj.radius * 0.28, ...aim };
    }
    const range = preferredRange(body, action, hint);
    const toX = obj.x - body.x;
    const toY = obj.y - body.y;
    const gap = Math.hypot(toX, toY) || 1;
    const nx = toX / gap;
    const ny = toY / gap;
    const stand = obj.radius + range * (ranged ? 0.85 : 0.55);
    return {
      x: obj.x - nx * stand + -ny * 22 * flankSign,
      y: obj.y - ny * stand + nx * 22 * flankSign,
      halt: Math.abs(gap - stand) < 16,
      ...aim,
    };
  }

  if (!target) {
    const dest = idleAnchor(body, now, slot, hint);
    const gap = Math.hypot(dest.x - body.x, dest.y - body.y);
    const aim = aimTo(dest.x, dest.y);
    const hold = action === 'hold_position' || action === 'wait_for_opening';
    return { x: dest.x, y: dest.y, halt: hold ? gap < 42 : gap < 36, ...aim };
  }

  const range = preferredRange(body, action, hint);
  const toX = target.x - body.x;
  const toY = target.y - body.y;
  const gap = Math.hypot(toX, toY) || 1;
  const ranged = isRangedMove(body, hint);

  if (action === 'wait_for_opening' || action === 'hold_position') {
    const nx = toX / gap;
    const ny = toY / gap;
    const radius = range + 16;
    const gx = target.x - nx * radius + -ny * 26 * flankSign;
    const gy = target.y - ny * radius + nx * 26 * flankSign;
    const aim = aimTo(target.x, target.y);
    const standGap = Math.hypot(gx - body.x, gy - body.y);
    const halt = action === 'hold_position' && standGap < 22;
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
    const back = ranged && gap < range * 0.7 ? range * 1.02 : range;
    const gx = target.x - nx * back + -ny * 46 * side;
    const gy = target.y - ny * back + nx * 46 * side;
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
  const stand = range * (ranged ? 0.9 : 0.64);
  const slop = range * 0.2;
  const gx = target.x - nx * stand + -ny * 14 * flankSign;
  const gy = target.y - ny * stand + nx * 14 * flankSign;
  if (ranged && gap < range - slop && action !== 'chase' && action !== 'finish_target') {
    const side = flankSign >= 0 ? 1 : -1;
    return {
      x: target.x - nx * range + -ny * 32 * side,
      y: target.y - ny * range + nx * 32 * side,
      halt: false,
      aimX: nx,
      aimY: ny,
    };
  }
  const toStand = Math.hypot(gx - body.x, gy - body.y);
  if (toStand < 16 && action !== 'chase' && action !== 'finish_target') {
    return { x: gx, y: gy, halt: true, aimX: nx, aimY: ny };
  }
  return { x: gx, y: gy, halt: false, aimX: nx, aimY: ny };
};
