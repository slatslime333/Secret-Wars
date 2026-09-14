import { ARENA, atFarEdge, nearestLane, roamHuntPoint } from '../../config/arena';
import type { ObjectiveKind } from '../../config/objective';
import type { KitStance, TacticalAction } from './types';
import { clearanceFor, nudgeOffMates, protectStand, regroupStand, type CrowdMate } from './spacing';

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
  id?: number;
};

export type MoveFocus = {
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  vx?: number;
  vy?: number;
};

export type MoveHint = {
  stance?: KitStance;
  preferredRange?: number;
  anchorX?: number;
  anchorY?: number;
  mates?: CrowdMate[];
  clusterRisk?: number;
  objective?: {
    kind: ObjectiveKind;
    x: number;
    y: number;
    radius: number;
    huntX?: number;
    huntY?: number;
    guardX?: number;
    guardY?: number;
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

const isZoneKind = (kind: ObjectiveKind): boolean => kind === 'capture_zone' || kind === 'healing_shrine';

const clampInCircle = (
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number } => {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d <= radius || d < 1) {
    return { x, y };
  }
  return { x: cx + (dx / d) * radius, y: cy + (dy / d) * radius };
};

const standInZone = (
  body: MoveBody,
  obj: NonNullable<MoveHint['objective']>,
  target: MoveFocus | undefined,
  flankSign: number,
  ranged: boolean,
  slot: number,
): { x: number; y: number; halt: boolean } => {
  const inner = obj.radius * (ranged ? 0.62 : 0.42);
  let gx = obj.x + flankSign * 14;
  let gy = obj.y + (slot % 2 === 0 ? 12 : -12);
  if (target) {
    const tx = target.x - obj.x;
    const ty = target.y - obj.y;
    const tlen = Math.hypot(tx, ty) || 1;
    const pull = Math.min(inner, tlen * 0.5);
    gx = obj.x + (tx / tlen) * pull;
    gy = obj.y + (ty / tlen) * pull;
  }
  const clamped = clampInCircle(gx, gy, obj.x, obj.y, inner);
  const gap = Math.hypot(clamped.x - body.x, clamped.y - body.y);
  return { x: clamped.x, y: clamped.y, halt: gap < 20 };
};

const applyCrowd = (
  dest: { x: number; y: number },
  body: MoveBody,
  action: TacticalAction,
  slot: number,
  hint?: MoveHint,
): { x: number; y: number } => {
  const gap = clearanceFor(body, action, hint?.stance, hint?.clusterRisk ?? 0);
  return nudgeOffMates(dest.x, dest.y, { ...body, id: body.id ?? slot }, hint?.mates, action, gap);
};

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
  const finish = (sample: MoveSample): MoveSample => {
    const next = applyCrowd(sample, body, action, slot, hint);
    return { ...sample, x: next.x, y: next.y };
  };

  if (action === 'retreat' || action === 'escape' || action === 'recover') {
    const destX = retreatGoal?.x ?? homeX;
    const destY = retreatGoal?.y ?? homeY;
    const spread = applyCrowd({ x: destX, y: destY }, body, action, slot, hint);
    const gap = Math.hypot(spread.x - body.x, spread.y - body.y);
    const aim = target ? aimTo(target.x, target.y) : aimTo(spread.x, spread.y);
    const halt = action === 'recover' && gap < 40;
    return {
      x: spread.x,
      y: spread.y,
      halt,
      aimX: target ? -aim.aimX : aim.aimX,
      aimY: target ? -aim.aimY : aim.aimY,
    };
  }

  if (action === 'regroup') {
    const dest = ally
      ? regroupStand(body, ally, isRangedMove(body, hint), flankSign, slot)
      : idleAnchor(body, now, slot, hint);
    const spread = applyCrowd(dest, body, action, slot, hint);
    const gap = Math.hypot(spread.x - body.x, spread.y - body.y);
    const aim = target ? aimTo(target.x, target.y) : aimTo(spread.x, spread.y);
    return { x: spread.x, y: spread.y, halt: gap < 36, ...aim };
  }

  if (action === 'contest_objective' && hint?.objective) {
    const obj = hint.objective;
    const ranged = isRangedMove(body, hint);
    const support = hint.stance === 'support';
    const aim = target ? aimTo(target.x, target.y) : aimTo(obj.x, obj.y);
    if (isZoneKind(obj.kind)) {
      const stand = standInZone(body, obj, target, flankSign, ranged || support, slot);
      return finish({ ...stand, ...aim });
    }
    if (obj.kind === 'bounty_target') {
      const huntX = obj.huntX ?? obj.x;
      const huntY = obj.huntY ?? obj.y;
      const guardX = obj.guardX;
      const guardY = obj.guardY;
      const selfMarked =
        guardX !== undefined && guardY !== undefined && Math.hypot(guardX - body.x, guardY - body.y) < 48;
      if (selfMarked) {
        const stand = preferredRange(body, action, hint) + 36;
        const toX = huntX - body.x;
        const toY = huntY - body.y;
        const gap = Math.hypot(toX, toY) || 1;
        return finish({
          x: huntX - (toX / gap) * stand,
          y: huntY - (toY / gap) * stand,
          halt: gap < stand + 12,
          ...aimTo(huntX, huntY),
        });
      }
      if (guardX !== undefined && guardY !== undefined && (!target || Math.hypot(body.x - guardX, body.y - guardY) > 90)) {
        const gx = guardX + -flankSign * 36;
        const gy = guardY + 22 * flankSign;
        const gap = Math.hypot(gx - body.x, gy - body.y);
        return finish({ x: gx, y: gy, halt: gap < 28, ...aimTo(huntX, huntY) });
      }
      const toX = huntX - body.x;
      const toY = huntY - body.y;
      const gap = Math.hypot(toX, toY) || 1;
      const stand = preferredRange(body, action, hint);
      return finish({
        x: huntX - (toX / gap) * stand + -(toY / gap) * 20 * flankSign,
        y: huntY - (toY / gap) * stand + (toX / gap) * 20 * flankSign,
        halt: Math.abs(gap - stand) < 18,
        ...aimTo(huntX, huntY),
      });
    }
    const range = preferredRange(body, action, hint);
    const destX = obj.x;
    const destY = obj.y;
    const dx = destX - body.x;
    const dy = destY - body.y;
    const gap = Math.hypot(dx, dy) || 1;
    const nx = dx / gap;
    const ny = dy / gap;
    const stand =
      obj.kind === 'executioner'
        ? Math.max(
            obj.radius + 18,
            Math.min(body.attackRange * (ranged ? 0.86 : 0.9), body.attackRange + obj.radius * 0.2),
          )
        : obj.radius + range * (ranged ? 0.85 : 0.55);
    let gx = destX - nx * stand + -ny * 22 * flankSign;
    let gy = destY - ny * stand + nx * 22 * flankSign;
    if (target && Math.hypot(target.x - destX, target.y - destY) < obj.radius + 140) {
      gx += -ny * 18 * flankSign;
      gy += nx * 18 * flankSign;
    }
    return finish({
      x: gx,
      y: gy,
      halt: Math.abs(gap - stand) < (obj.kind === 'executioner' ? 22 : 16),
      ...aim,
    });
  }

  if (!target) {
    const dest = applyCrowd(idleAnchor(body, now, slot, hint), body, action, slot, hint);
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

  if (
    hint?.objective &&
    isZoneKind(hint.objective.kind) &&
    (action === 'attack' || action === 'assist_ally' || action === 'finish_target' || action === 'flank')
  ) {
    const obj = hint.objective;
    const targetNear = Math.hypot(target.x - obj.x, target.y - obj.y) < obj.radius + 100;
    const selfNear = Math.hypot(body.x - obj.x, body.y - obj.y) < obj.radius + 170;
    if (targetNear && selfNear) {
      const stand = standInZone(body, obj, target, flankSign, ranged, slot);
      return finish({ ...stand, ...aimTo(target.x, target.y) });
    }
  }

  if (action === 'wait_for_opening' || action === 'hold_position') {
    const nx = toX / gap;
    const ny = toY / gap;
    const radius = range + 16;
    const gx = target.x - nx * radius + -ny * 26 * flankSign;
    const gy = target.y - ny * radius + nx * 26 * flankSign;
    const aim = aimTo(target.x, target.y);
    const standGap = Math.hypot(gx - body.x, gy - body.y);
    const halt = action === 'hold_position' && standGap < 22;
    return finish({ x: gx, y: gy, halt, ...aim });
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
    return finish({ x: gx, y: gy, halt: false, ...aim });
  }

  if (action === 'reposition') {
    const side = flankSign >= 0 ? 1 : -1;
    const nx = toX / gap;
    const ny = toY / gap;
    const back = ranged && gap < range * 0.7 ? range * 1.02 : range;
    const gx = target.x - nx * back + -ny * 46 * side;
    const gy = target.y - ny * back + nx * 46 * side;
    const aim = aimTo(target.x, target.y);
    return finish({ x: gx, y: gy, halt: false, ...aim });
  }

  if (action === 'protect_ally' && ally) {
    const stand = protectStand(body, ally, target, flankSign, ranged, slot);
    return finish({ x: stand.x, y: stand.y, halt: false, ...aimTo(target.x, target.y) });
  }

  if (action === 'intercept') {
    const obj = hint?.objective;
    const vx = target.vx ?? target.aimX * 90;
    const vy = target.vy ?? target.aimY * 90;
    if (obj && obj.kind !== 'bounty_target') {
      const toObjX = obj.x - target.x;
      const toObjY = obj.y - target.y;
      const toObj = Math.hypot(toObjX, toObjY) || 1;
      const closing = (vx * toObjX + vy * toObjY) / (Math.max(18, Math.hypot(vx, vy)) * toObj);
      if (closing > 0.2 && toObj > obj.radius) {
        const lead = Math.min(toObj * 0.55, 220);
        const gx = target.x + (toObjX / toObj) * lead;
        const gy = target.y + (toObjY / toObj) * lead;
        return finish({ x: gx, y: gy, halt: false, ...aimTo(gx, gy) });
      }
    }
    const gx = target.x + vx * 0.28;
    const gy = target.y + vy * 0.28;
    const aim = aimTo(gx, gy);
    return finish({ x: gx, y: gy, halt: false, ...aim });
  }

  const nx = toX / gap;
  const ny = toY / gap;
  const stand = range * (ranged ? 0.9 : 0.64);
  const slop = range * 0.2;
  const gx = target.x - nx * stand + -ny * 14 * flankSign;
  const gy = target.y - ny * stand + nx * 14 * flankSign;
  if (ranged && gap < range - slop && action !== 'chase' && action !== 'finish_target') {
    const side = flankSign >= 0 ? 1 : -1;
    return finish({
      x: target.x - nx * range + -ny * 32 * side,
      y: target.y - ny * range + nx * 32 * side,
      halt: false,
      aimX: nx,
      aimY: ny,
    });
  }
  const toStand = Math.hypot(gx - body.x, gy - body.y);
  if (toStand < 16 && action !== 'chase' && action !== 'finish_target') {
    return finish({ x: gx, y: gy, halt: true, aimX: nx, aimY: ny });
  }
  return finish({ x: gx, y: gy, halt: false, aimX: nx, aimY: ny });
};
