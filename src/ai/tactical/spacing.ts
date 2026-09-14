import type { KitStance, TacticalAction, TacticalKind } from './types';

export type CrowdMate = {
  x: number;
  y: number;
  id: number;
  kind: TacticalKind;
  role?: string;
  attackRange?: number;
};

export type MoveBodyLike = {
  x: number;
  y: number;
  team: 'alpha' | 'bravo';
  attackRange: number;
  role: string;
  kind: 'hero' | 'minion';
  id?: number;
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const hash01 = (n: number): number => {
  const x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return (x % 1000) / 1000;
};

/** Visible kit traits a player can know. Not cooldowns or hidden meters. */
export const looksLikeWideHitter = (unit: { role: string; heroId?: string; attackRange: number }): boolean => {
  if (unit.attackRange >= 150) {
    return true;
  }
  if (unit.role === 'ranged' || unit.role === 'ranged-tank' || unit.role === 'support') {
    return true;
  }
  const id = unit.heroId;
  return id === 'cole' || id === 'death' || id === 'witch' || id === 'rope';
};

/**
 * How stacked we look versus a nearby wide swing. 0 = fine, 1 = one hit could
 * clip several teammates.
 */
export const clusterRiskOf = (
  self: { x: number; y: number; kind?: TacticalKind },
  allies: Array<{ x: number; y: number; kind?: TacticalKind }>,
  enemies: Array<{
    x: number;
    y: number;
    kind?: TacticalKind;
    visible?: boolean;
    attacking?: boolean;
    role: string;
    heroId?: string;
    attackRange: number;
  }>,
): number => {
  const packed = allies.filter((ally) => {
    if (self.kind === 'hero' && ally.kind && ally.kind !== 'hero') {
      return false;
    }
    return Math.hypot(ally.x - self.x, ally.y - self.y) < 72;
  }).length;
  if (packed <= 0) {
    return 0;
  }
  let threat = 0;
  for (const enemy of enemies) {
    if (enemy.kind === 'minion' || enemy.visible === false) {
      continue;
    }
    const reach = enemy.attackRange * 1.35 + 36;
    if (Math.hypot(enemy.x - self.x, enemy.y - self.y) > reach) {
      continue;
    }
    if (!looksLikeWideHitter(enemy) && !enemy.attacking) {
      continue;
    }
    threat += packed * (enemy.attacking ? 0.28 : 0.14);
  }
  return clamp(threat, 0, 1);
};

export const clearanceFor = (
  body: MoveBodyLike,
  action: TacticalAction,
  stance?: KitStance,
  clusterRisk = 0,
): number => {
  const ranged = stance === 'ranged' || stance === 'support' || body.role === 'support' || body.role === 'ranged' || body.role === 'ranged-tank';
  const tank = body.role === 'frontliner' || body.role === 'tank' || body.role === 'ranged-tank';
  let gap = body.kind === 'minion' ? (body.role === 'minion' && body.attackRange > 80 ? 26 : 20) : ranged ? 44 : 30;
  if (tank && body.kind === 'hero' && !(stance === 'ranged' && body.role === 'frontliner')) {
    gap *= 0.78;
  }
  if (action === 'protect_ally') {
    gap = Math.max(gap, ranged ? 48 : 38);
  }
  if (action === 'regroup') {
    gap = Math.max(gap, ranged ? 52 : 36);
  }
  if (action === 'assist_ally' || action === 'attack') {
    gap *= 0.86;
  }
  if (action === 'finish_target' || action === 'chase' || action === 'escape') {
    gap *= 0.55;
  }
  gap *= 1 + clusterRisk * 0.45;
  const jitter = 0.86 + hash01((body.id ?? 3) * 13 + body.x * 0.01) * 0.22;
  return gap * jitter;
};

const spreadWeight = (action: TacticalAction): number => {
  if (action === 'escape' || action === 'retreat') {
    return 0.22;
  }
  if (action === 'finish_target' || action === 'chase') {
    return 0.38;
  }
  if (action === 'protect_ally' || action === 'regroup') {
    return 1;
  }
  return 0.72;
};

/** Soft push off nearby allies. Does not freeze movement or form a ring. */
export const nudgeOffMates = (
  x: number,
  y: number,
  body: MoveBodyLike,
  mates: readonly CrowdMate[] | undefined,
  action: TacticalAction,
  minGap: number,
): { x: number; y: number } => {
  if (!mates || mates.length === 0) {
    return { x, y };
  }
  const weight = spreadWeight(action);
  let gx = x;
  let gy = y;
  for (const mate of mates) {
    if (mate.id === body.id) {
      continue;
    }
    const need = mate.kind === 'minion' && body.kind === 'hero' ? minGap * 0.55 : minGap;
    let dx = gx - mate.x;
    let dy = gy - mate.y;
    let d = Math.hypot(dx, dy);
    if (d < 1.2) {
      const ang = hash01(mate.id * 31 + (body.id ?? 7) * 17) * Math.PI * 2;
      dx = Math.cos(ang);
      dy = Math.sin(ang) * 1.15;
      d = 1;
    }
    if (d >= need) {
      continue;
    }
    const push = (need - d) * 0.58 * weight;
    gx += (dx / d) * push;
    gy += (dy / d) * push;
  }
  return { x: gx, y: gy };
};

export const protectStand = (
  body: MoveBodyLike,
  ally: { x: number; y: number },
  threat: { x: number; y: number },
  flankSign: number,
  ranged: boolean,
  slot: number,
): { x: number; y: number } => {
  const tx = threat.x - ally.x;
  const ty = threat.y - ally.y;
  const tlen = Math.hypot(tx, ty) || 1;
  const nx = tx / tlen;
  const ny = ty / tlen;
  const cover = ranged ? 46 : body.role === 'frontliner' || body.role === 'tank' ? 28 : 36;
  const side = (ranged ? 54 : 40) * (flankSign >= 0 ? 1 : -1);
  const slotBias = (slot % 3) - 1;
  return {
    x: ally.x + nx * cover + -ny * (side + slotBias * 18),
    y: ally.y + ny * cover + nx * (side + slotBias * 16),
  };
};

export const regroupStand = (
  body: MoveBodyLike,
  ally: { x: number; y: number },
  ranged: boolean,
  flankSign: number,
  slot: number,
): { x: number; y: number } => {
  const back = body.team === 'alpha' ? -1 : 1;
  const along = ranged ? 64 : body.role === 'frontliner' || body.role === 'tank' ? 32 : 40;
  const side = (ranged ? 46 : 34) * (flankSign >= 0 ? 1 : -1);
  const lane = ((slot % 5) - 2) * 12;
  return {
    x: ally.x + back * along,
    y: ally.y + side + lane,
  };
};

/** Idle skeleton / guard offset: a short wedge beside the owner, not a ring. */
export const guardHome = (
  owner: { x: number; y: number; team: 'alpha' | 'bravo' },
  slot: number,
): { x: number; y: number } => {
  const back = owner.team === 'alpha' ? -1 : 1;
  const lane = (slot % 5) - 2;
  return {
    x: owner.x + back * (22 + Math.abs(lane) * 6),
    y: owner.y + lane * 22 + (slot % 2 === 0 ? 10 : -10),
  };
};

export const minionLaneSpread = (
  body: MoveBodyLike,
  mates: readonly CrowdMate[] | undefined,
  dx: number,
  dy: number,
): { x: number; y: number } => {
  let ox = dx;
  let oy = dy;
  if (!mates) {
    return { x: ox, y: oy };
  }
  for (const mate of mates) {
    if (mate.id === body.id || mate.kind !== 'minion') {
      continue;
    }
    const mx = body.x - mate.x;
    const my = body.y - mate.y;
    const d = Math.hypot(mx, my);
    if (d > 38 || d < 0.4) {
      if (d < 0.4) {
        oy += (hash01(mate.id) > 0.5 ? 1 : -1) * 0.45;
      }
      continue;
    }
    if (d < 14) {
      oy += (my / d) * 0.85;
      ox += (mx / d) * 0.12;
    } else if (d < 28) {
      oy += (my / d) * 0.38;
    } else {
      oy += (my / d) * 0.16;
    }
  }
  return { x: ox, y: oy };
};
