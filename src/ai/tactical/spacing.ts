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

const isHeroMate = (
  self: { kind?: TacticalKind },
  ally: { kind?: TacticalKind },
): boolean => !(self.kind === 'hero' && ally.kind && ally.kind !== 'hero');

/**
 * How many teammates already occupy this patch. Independent of enemy kits.
 * Clustering has a cost even when nobody is swinging a wide hit.
 */
export const occupancyOf = (
  self: { x: number; y: number; kind?: TacticalKind },
  allies: Array<{ x: number; y: number; kind?: TacticalKind }>,
): number => {
  let packed = 0;
  let near = 0;
  for (const ally of allies) {
    if (!isHeroMate(self, ally)) {
      continue;
    }
    const d = Math.hypot(ally.x - self.x, ally.y - self.y);
    if (d < 72) {
      packed += 1;
    } else if (d < 124) {
      near += 1;
    }
  }
  if (packed <= 0 && near <= 0) {
    return 0;
  }
  return clamp(packed * 0.24 + near * 0.09, 0, 1);
};

/** Allies already standing on a candidate walk point. */
export const areaLoad = (
  x: number,
  y: number,
  mates: ReadonlyArray<{ x: number; y: number; id?: number; kind?: TacticalKind }>,
  selfId?: number,
  radius = 92,
): number => {
  let n = 0;
  for (const mate of mates) {
    if (mate.id === selfId) {
      continue;
    }
    if (mate.kind === 'minion') {
      continue;
    }
    if (Math.hypot(mate.x - x, mate.y - y) < radius) {
      n += 1;
    }
  }
  return n;
};

/**
 * How stacked we look. Occupancy always costs; a nearby wide swing stacks
 * extra. Previously this returned 0 unless a wide-hitter was in range, so
 * whole teams still piled in open fights.
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
  const occupancy = occupancyOf(self, allies);
  const packed = allies.filter((ally) => isHeroMate(self, ally) && Math.hypot(ally.x - self.x, ally.y - self.y) < 72)
    .length;
  let threat = 0;
  if (packed > 0) {
    for (const enemy of enemies) {
      if (enemy.kind === 'minion' || enemy.visible === false) {
        continue;
      }
      const reach = enemy.attackRange * 1.35 + 36;
      const toEnemy = Math.hypot(enemy.x - self.x, enemy.y - self.y);
      if (toEnemy > reach) {
        continue;
      }
      if (looksLikeWideHitter(enemy) || enemy.attacking) {
        threat += packed * (enemy.attacking ? 0.28 : 0.14);
      }
      const envelope = enemy.attackRange * 1.18 + 18;
      if (toEnemy > envelope) {
        continue;
      }
      let sharing = 0;
      for (const ally of allies) {
        if (!isHeroMate(self, ally)) {
          continue;
        }
        if (Math.hypot(ally.x - enemy.x, ally.y - enemy.y) > envelope) {
          continue;
        }
        if (Math.hypot(ally.x - self.x, ally.y - self.y) > 120) {
          continue;
        }
        sharing += 1;
      }
      if (sharing <= 0) {
        continue;
      }
      const meleePocket = enemy.attackRange < 160;
      threat += sharing * (meleePocket ? 0.12 : 0.08) * (enemy.attacking ? 1.15 : 1);
    }
  }
  return clamp(occupancy * 0.62 + threat, 0, 1);
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
    gap = Math.max(gap, ranged ? 68 : 52);
  }
  if (action === 'regroup') {
    gap = Math.max(gap, ranged ? 70 : 48);
  }
  if (action === 'assist_ally' || action === 'attack' || action === 'flank') {
    gap *= ranged ? 1.08 : 1.02;
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
    const push = (need - d) * 0.82 * weight;
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
  const tank = body.role === 'frontliner' || body.role === 'tank';
  const cover = ranged ? 78 : tank ? 54 : 66;
  const side = (ranged ? 88 : 72) * (flankSign >= 0 ? 1 : -1);
  const mode = slot % 4;
  if (mode === 3) {
    return {
      x: ally.x - nx * (ranged ? 72 : 50) + -ny * side * 0.42,
      y: ally.y - ny * (ranged ? 72 : 50) + nx * side * 0.42,
    };
  }
  const along = mode === 0 ? cover : cover * 0.52;
  const lat = mode === 0 ? side * 0.38 : side + ((mode % 3) - 1) * 24;
  return {
    x: ally.x + nx * along + -ny * lat,
    y: ally.y + ny * along + nx * lat,
  };
};

/**
 * Pick a unique attack stand instead of the nearest point on the enemy.
 * Candidates are scored for range, teammate occupancy, and radial uniqueness
 * so flanking emerges from spacing rather than a timed FLANK script.
 */
export const combatStand = (
  body: MoveBodyLike,
  target: { x: number; y: number },
  action: TacticalAction,
  flankSign: number,
  slot: number,
  mates: readonly CrowdMate[] | undefined,
  stance?: KitStance,
  clusterRisk = 0,
  preferred = 80,
): { x: number; y: number } => {
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const gap = Math.hypot(dx, dy) || 1;
  const nx = dx / gap;
  const ny = dy / gap;
  const ranged =
    stance === 'ranged' ||
    stance === 'support' ||
    body.role === 'support' ||
    body.role === 'ranged' ||
    body.role === 'ranged-tank';
  const stand =
    action === 'flank'
      ? preferred * 0.58
      : action === 'finish_target' || action === 'chase'
        ? preferred * (ranged ? 0.82 : 0.58)
        : preferred * (ranged ? 0.9 : 0.7);
  const heading = Math.atan2(ny, nx);
  const angles = [0, 0.62 * flankSign, -0.78 * flankSign, 1.12 * flankSign, -1.22 * flankSign, ranged ? 0.28 : 2.2 * flankSign];
  let bestX = target.x - nx * stand;
  let bestY = target.y - ny * stand;
  let best = -1e9;
  const favorite = slot % angles.length;
  for (let i = 0; i < angles.length; i += 1) {
    const a = heading + angles[i];
    const dist = stand + (i === 0 ? 0 : 10 + clusterRisk * 22);
    const px = target.x - Math.cos(a) * dist;
    const py = target.y - Math.sin(a) * dist;
    let score = 18 - i * 1.2;
    if (i === favorite) {
      score += 9;
    }
    if (mates) {
      for (const mate of mates) {
        if (mate.id === body.id) {
          continue;
        }
        const md = Math.hypot(px - mate.x, py - mate.y);
        if (md < 74) {
          score -= (74 - md) * 0.42;
        } else if (md < 130) {
          score -= (130 - md) * 0.1;
        }
        const mateAng = Math.atan2(target.y - mate.y, target.x - mate.x);
        const da = Math.abs(Math.atan2(Math.sin(a - mateAng), Math.cos(a - mateAng)));
        if (da < 0.32 && md < 170) {
          score -= 12;
        }
      }
    }
    score -= Math.hypot(px - body.x, py - body.y) * 0.01;
    if (score > best) {
      best = score;
      bestX = px;
      bestY = py;
    }
  }
  return { x: bestX, y: bestY };
};

export const regroupStand = (
  body: MoveBodyLike,
  ally: { x: number; y: number },
  ranged: boolean,
  flankSign: number,
  slot: number,
): { x: number; y: number } => {
  const back = body.team === 'alpha' ? -1 : 1;
  const along = ranged ? 86 : body.role === 'frontliner' || body.role === 'tank' ? 48 : 62;
  const side = (ranged ? 64 : 48) * (flankSign >= 0 ? 1 : -1);
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
