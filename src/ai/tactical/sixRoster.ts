import { matchFormatOf } from '../../config/arena';
import type { TeamId } from '../../config/hero';
import type { SixZoneFact } from '../../match/objectives/sixZoneBoard';
import { sixZoneFacts } from '../../match/objectives/sixZoneBoard';
import type { KitStance, Personality, ScoredAction, Situation, TacticalAction } from './types';
import { NEUTRAL_PERSONALITY } from './types';

export type SixJob = 'capture' | 'defend' | 'contest' | 'fight' | 'flank' | 'farm' | 'rotate' | 'support' | 'regroup';

export type SixStand = 'inside' | 'perimeter' | 'intercept';

export type SixBody = {
  id: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  team: TeamId;
  kind?: 'hero' | 'minion';
  role?: string;
  heroId?: string;
  hpRatio?: number;
  attackRange?: number;
  power?: number;
  level?: number;
  xpRatio?: number;
  visible?: boolean;
  stance?: KitStance;
};

export type SixIntentPost = {
  id: number;
  job: SixJob;
  zoneId?: 'A' | 'B';
  at: number;
};

export type SixChoice = {
  job: SixJob;
  zoneId?: 'A' | 'B';
  stand: SixStand;
  x: number;
  y: number;
  radius: number;
  score: number;
  combat: number;
  farm: number;
  alliesOnZone: number;
  alliesInFight: number;
  fightHandled: boolean;
  debug: string;
  rejected: string;
};

type Write = (
  rows: ScoredAction[],
  used: number,
  action: TacticalAction,
  score: number,
  reason: string,
  targetId?: number,
  allyId?: number,
) => number;

const posts = new Map<number, SixIntentPost>();

const hypot = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

export const postSixIntent = (post: SixIntentPost): void => {
  posts.set(post.id, post);
};

export const clearSixIntents = (): void => {
  posts.clear();
};

export const sixIntents = (now: number, exceptId: number): SixIntentPost[] => {
  const live: SixIntentPost[] = [];
  for (const post of posts.values()) {
    if (post.id === exceptId || now - post.at > 1600) {
      continue;
    }
    live.push(post);
  }
  return live;
};

const movingToward = (body: SixBody, x: number, y: number): boolean => {
  const vx = body.vx ?? 0;
  const vy = body.vy ?? 0;
  const speed = Math.hypot(vx, vy);
  if (speed < 18) {
    return false;
  }
  const dx = x - body.x;
  const dy = y - body.y;
  const len = Math.hypot(dx, dy) || 1;
  return (vx * dx + vy * dy) / (speed * len) > 0.35;
};

const foeOf = (team: TeamId): TeamId => (team === 'alpha' ? 'bravo' : 'alpha');

type ZoneRead = {
  fact: SixZoneFact;
  job: SixJob;
  value: number;
  committed: number;
  enemies: number;
  approaching: SixBody[];
  stand: SixStand;
  /** Still short a body. A staffed fight is not an urgent reason to ignore a crate. */
  short: boolean;
};

const committedIds = (
  zone: SixZoneFact,
  allies: readonly SixBody[],
  intents: readonly SixIntentPost[],
): Set<number> => {
  const ids = new Set<number>();
  const reach = zone.radius + 90;
  for (const ally of allies) {
    if ((ally.kind ?? 'hero') !== 'hero') {
      continue;
    }
    if (hypot(ally.x, ally.y, zone.x, zone.y) <= reach) {
      ids.add(ally.id);
    }
  }
  for (const post of intents) {
    if (post.zoneId === zone.id && (post.job === 'capture' || post.job === 'defend' || post.job === 'contest' || post.job === 'rotate' || post.job === 'support')) {
      ids.add(post.id);
    }
  }
  return ids;
};

type FightRead = {
  x: number;
  y: number;
  allies: number;
  enemies: number;
  allyHp: number;
  enemyHp: number;
  losing: boolean;
  handled: boolean;
  selfIn: boolean;
};

const readFight = (self: SixBody, allies: readonly SixBody[], enemies: readonly SixBody[]): FightRead => {
  const heroes = enemies.filter((enemy) => (enemy.kind ?? 'hero') === 'hero' && enemy.visible !== false);
  let best: SixBody[] = [];
  for (const seed of heroes) {
    const group = heroes.filter((enemy) => hypot(enemy.x, enemy.y, seed.x, seed.y) < 300);
    if (group.length > best.length) {
      best = group;
    }
  }
  if (best.length === 0) {
    return { x: self.x, y: self.y, allies: 0, enemies: 0, allyHp: 1, enemyHp: 1, losing: false, handled: false, selfIn: false };
  }
  let x = 0;
  let y = 0;
  let enemyHp = 0;
  for (const enemy of best) {
    x += enemy.x;
    y += enemy.y;
    enemyHp += enemy.hpRatio ?? 1;
  }
  x /= best.length;
  y /= best.length;
  enemyHp /= best.length;
  let alliesN = 0;
  let allyHp = 0;
  for (const ally of allies) {
    if ((ally.kind ?? 'hero') !== 'hero') {
      continue;
    }
    if (hypot(ally.x, ally.y, x, y) < 240) {
      alliesN += 1;
      allyHp += ally.hpRatio ?? 1;
    }
  }
  if (alliesN > 0) {
    allyHp /= alliesN;
  }
  const selfIn = hypot(self.x, self.y, x, y) < 200;
  const losing = best.length >= alliesN + 1 || (alliesN > 0 && allyHp + 0.15 < enemyHp && best.length >= alliesN);
  const extra = alliesN - best.length;
  const handled = !losing && alliesN >= best.length && alliesN >= 2 && extra >= 0;
  return { x, y, allies: alliesN, enemies: best.length, allyHp, enemyHp, losing, handled, selfIn };
};

const personalityOf = (personality?: Personality): Personality => personality ?? NEUTRAL_PERSONALITY;

/**
 * One hero's 6v6 job. Commitments already taken by teammates reduce the value
 * of joining the same fight or the same zone.
 */
export const chooseSixRole = (input: {
  self: SixBody;
  allies: readonly SixBody[];
  enemies: readonly SixBody[];
  zones: readonly SixZoneFact[];
  intents?: readonly SixIntentPost[];
  personality?: Personality;
  teamScore?: { self: number; enemy: number };
  remainingMs?: number;
  now?: number;
  crate?: { x: number; y: number };
}): SixChoice => {
  const personality = personalityOf(input.personality);
  const self = input.self;
  const foe = foeOf(self.team);
  const intents = input.intents ?? [];
  const fight = readFight(self, input.allies, input.enemies);
  const melee = (self.stance ?? 'melee') === 'melee' || self.role === 'frontliner' || self.role === 'tank';
  const ranged = self.stance === 'ranged' || self.role === 'ranged' || self.role === 'ranged-tank';
  const support = self.stance === 'support' || self.role === 'support' || self.role === 'disruptor';
  const flanker = self.heroId === 'ninja' || self.heroId === 'shadow' || self.stance === 'skirmish' || personality.flankTendency > 0.62;
  const cautious = personality.caution > 0.58 || personality.opportunism > 0.62;
  const lead = (input.teamScore?.self ?? 0) - (input.teamScore?.enemy ?? 0);
  const late = (input.remainingMs ?? 240000) < 90_000;
  const behind = lead < -40;

  let combat = 0;
  let nearest: SixBody | undefined;
  let nearestD = 9999;
  for (const enemy of input.enemies) {
    if ((enemy.kind ?? 'hero') !== 'hero' || enemy.visible === false) {
      continue;
    }
    const d = hypot(self.x, self.y, enemy.x, enemy.y);
    if (d < nearestD) {
      nearest = enemy;
      nearestD = d;
    }
  }
  if (nearest) {
    const isoGuards = input.enemies.filter(
      (enemy) => enemy !== nearest && (enemy.kind ?? 'hero') === 'hero' && hypot(enemy.x, enemy.y, nearest.x, nearest.y) < 170,
    ).length;
    combat = 34 - (nearestD / 780) * 28 + (1 - (nearest.hpRatio ?? 1)) * 16;
    if (isoGuards === 0 && (nearest.hpRatio ?? 1) < 0.5 && nearestD < 460) {
      combat += 18 + personality.opportunism * 8;
    }
    if (melee && nearestD < (self.attackRange ?? 70) * 1.4) {
      combat += 8 + personality.aggression * 6;
    }
    if (fight.losing && !fight.selfIn) {
      combat += 14 + personality.teamwork * 8;
    }
  }

  const extra = fight.allies - Math.max(1, fight.enemies);
  let penalty = 0;
  if (!fight.losing) {
    if (extra >= 3 || fight.allies >= 5) {
      penalty = 42 + personality.independence * 10;
    } else if (extra >= 2 || fight.allies >= 4) {
      penalty = 28 + personality.independence * 8;
    } else if (extra >= 1 || fight.allies >= 3) {
      penalty = 12 + personality.independence * 4;
    }
  } else if (fight.allies >= fight.enemies + 2) {
    penalty = 16;
  }
  if (!fight.selfIn) {
    combat -= penalty;
  } else if (fight.allies >= 5 && !fight.losing) {
    combat -= 10 + personality.opportunism * 8;
  }
  const fightHandled = fight.handled && penalty >= 12;

  const zones: ZoneRead[] = [];
  for (const fact of input.zones) {
    if (fact.phase !== 'active') {
      continue;
    }
    const committed = committedIds(fact, input.allies, intents);
    const nearEnemies = input.enemies.filter(
      (enemy) => (enemy.kind ?? 'hero') === 'hero' && enemy.visible !== false && hypot(enemy.x, enemy.y, fact.x, fact.y) < fact.radius + 220,
    );
    const approaching = input.enemies.filter(
      (enemy) =>
        (enemy.kind ?? 'hero') === 'hero' &&
        enemy.visible !== false &&
        hypot(enemy.x, enemy.y, fact.x, fact.y) < 620 &&
        hypot(enemy.x, enemy.y, fact.x, fact.y) > fact.radius &&
        movingToward(enemy, fact.x, fact.y),
    );
    const ours = fact.secured === self.team;
    const enemyHeld = fact.secured === foe;
    const enemyChannel = fact.owner === foe && fact.progress > 0.04 && fact.secured !== foe && fact.secured !== self.team;
    const weChannel = fact.owner === self.team && fact.progress > 0.04 && !fact.secured;
    const dist = hypot(self.x, self.y, fact.x, fact.y);
    let job: SixJob = 'capture';
    let value = 28 - dist / 95;
    if (fact.contested || (nearEnemies.length > 0 && committed.size > 0)) {
      job = 'contest';
      value = 52 + fact.progress * 18 - dist / 110;
      if (melee || personality.aggression > 0.6) {
        value += 8;
      }
    } else if (enemyChannel) {
      job = fact.progress >= 0.35 ? 'contest' : 'rotate';
      value = 56 + fact.progress * 42 - dist / 120;
    } else if (ours && (approaching.length > 0 || nearEnemies.length > 0)) {
      job = 'defend';
      value = 60 + approaching.length * 8 - dist / 120;
    } else if (ours) {
      job = 'defend';
      value = 34 - dist / 140;
      if (late) {
        value += 8;
      }
    } else if (enemyHeld) {
      job = 'capture';
      value = 58 - dist / 100;
    } else if (weChannel) {
      job = 'support';
      value = 40 + fact.progress * 20 - dist / 110;
    } else {
      job = 'capture';
      value = 62 - dist / 100;
    }
    if (behind && late) {
      value += 12;
    }
    if (cautious && job === 'capture' && nearEnemies.length === 0) {
      value += 8;
    }
    if (support && (job === 'defend' || job === 'support') && committed.size > 0) {
      value += 6 + personality.protectionInstinct * 6;
    }
    if (flanker && job === 'contest') {
      value += 4;
    }
    if ((self.id + (personality.independence > 0.55 ? 1 : 0)) % 2 === (fact.id === 'A' ? 0 : 1)) {
      value += 12;
    }
    const hot = fact.contested || enemyChannel || approaching.length > 0 || nearEnemies.length > 0;
    const pressure = nearEnemies.length + approaching.length;
    const zoneLosing = nearEnemies.length >= committed.size + 1;
    const short = pressure > 0 && committed.size < Math.max(enemyChannel || fact.contested ? 2 : 1, pressure);
    let stand: SixStand = 'inside';
    if (hot) {
      const want = Math.max(2, nearEnemies.length + (zoneLosing ? 1 : 0));
      if (!zoneLosing && committed.size >= nearEnemies.length + 1 && committed.size >= 3) {
        value *= 0.16;
      } else if (!zoneLosing && committed.size >= nearEnemies.length && committed.size >= 3) {
        value *= 0.34;
      } else if (committed.size >= want + 2) {
        value *= 0.15;
      } else if (committed.size >= want + 1) {
        value *= 0.4;
      } else if (committed.size >= want) {
        value *= 0.7;
      }
      stand = flanker || ranged ? 'intercept' : 'inside';
    } else if (job === 'defend' && ours) {
      if (committed.size === 1) {
        value *= 0.78;
      } else if (committed.size >= 2) {
        value *= 0.18;
      }
      stand = committed.size === 0 && !ranged ? 'inside' : 'perimeter';
    } else {
      if (committed.size === 1) {
        value *= 0.42;
      } else if (committed.size >= 2) {
        value *= 0.14;
      }
      stand = committed.size === 0 && !ranged ? 'inside' : 'perimeter';
    }
    if (flanker && approaching.length > 0) {
      stand = 'intercept';
    }
    if (dist > 1400) {
      value *= 0.55;
    }
    zones.push({ fact, job, value, committed: committed.size, enemies: pressure, approaching, stand, short });
  }

  zones.sort((a, b) => b.value - a.value);
  const bestZone = zones[0];
  const second = zones[1];
  if (bestZone && second && Math.abs(bestZone.value - second.value) < 8 && bestZone.committed > second.committed) {
    zones[0] = second;
    zones[1] = bestZone;
  }
  const picked = zones[0];

  let farm = 0;
  const crate = input.crate;
  if (crate) {
    const gap = hypot(self.x, self.y, crate.x, crate.y);
    const level = self.level ?? 1;
    const xpRatio = self.xpRatio ?? 0.4;
    if (gap < 520 && level < 6) {
      farm = 26 + (1 - xpRatio) * 16 + (level < 3 ? 14 : level < 5 ? 6 : 0) - gap / 28;
      if (xpRatio > 0.7) {
        farm += 12;
      }
      if (fightHandled || penalty >= 20) {
        farm += 16 + personality.opportunism * 8;
      }
      if (cautious) {
        farm += 6;
      }
      const farmer = intents.some((post) => post.job === 'farm') || input.allies.some((ally) => hypot(ally.x, ally.y, crate.x, crate.y) < 80);
      if (farmer) {
        farm *= 0.32;
      }
      if (nearest && nearestD < (self.attackRange ?? 70) * 1.35 && !fightHandled) {
        farm = 0;
      }
    }
  }

  const critical = Boolean(
    picked && (picked.job === 'contest' || picked.job === 'defend') && picked.short && picked.value > 48,
  );
  if (critical) {
    farm = Math.min(farm, 10);
  }

  let job: SixJob = 'fight';
  let score = combat;
  let zoneId: 'A' | 'B' | undefined;
  let stand: SixStand = 'inside';
  let x = nearest?.x ?? self.x;
  let y = nearest?.y ?? self.y;
  let radius = 80;
  let alliesOnZone = 0;
  const rejected: string[] = [];

  if (picked && picked.value >= score && picked.value > 16) {
    job = picked.committed > 0 && picked.job === 'capture' ? 'rotate' : picked.job;
    score = picked.value;
    zoneId = picked.fact.id;
    stand = picked.stand;
    const point = sixStandPoint(self, picked.fact, stand, picked.approaching[0]);
    x = point.x;
    y = point.y;
    radius = picked.fact.radius;
    alliesOnZone = picked.committed;
  } else if (picked) {
    rejected.push(`zone ${picked.fact.id} ${Math.round(picked.value)}`);
  }
  if (farm > score && farm > 18 && !critical) {
    rejected.push(zoneId ? `${job} ${zoneId}` : `fight ${Math.round(combat)}`);
    job = 'farm';
    score = farm;
    zoneId = undefined;
    stand = 'inside';
    x = crate?.x ?? x;
    y = crate?.y ?? y;
  } else if (farm > 0) {
    rejected.push(`crate ${Math.round(farm)}`);
  }
  if (job === 'fight' && fightHandled) {
    job = flanker ? 'flank' : 'rotate';
  }
  if (job === 'fight') {
    rejected.push('left the map jobs');
  }

  const label =
    job === 'farm'
      ? 'FARM CRATE'
      : job === 'fight'
        ? 'FIGHT'
        : job === 'flank'
          ? 'FLANK'
          : `${job.toUpperCase()} ${zoneId ?? ''}`.trim();
  const rejectNote = rejected.length > 0 ? ` | reject ${rejected.join('; ')}` : '';
  const debug =
    job === 'farm'
      ? `FARM CRATE | XP value ${Math.round(farm)} | obj ${Math.round(picked?.value ?? 0)} | combat ${Math.round(combat)} | ${fightHandled ? `fight handled ${fight.allies}v${fight.enemies}` : 'no urgent objective'}${rejectNote}`
      : `${label} | obj ${Math.round(picked?.value ?? 0)} | combat ${Math.round(combat)} | ${alliesOnZone} ally committed | fight ${fight.allies}v${fight.enemies}${fightHandled ? ' handled' : ''}${rejectNote}`;

  return {
    job,
    zoneId,
    stand,
    x,
    y,
    radius,
    score,
    combat,
    farm,
    alliesOnZone,
    alliesInFight: fight.allies,
    fightHandled,
    debug,
    rejected: rejected.join(', ') || 'none',
  };
};

export const sixStandPoint = (
  self: { id: number; x: number; y: number },
  zone: { x: number; y: number },
  stand: SixStand,
  approach?: { x: number; y: number },
): { x: number; y: number } => {
  if (stand === 'intercept' && approach) {
    return {
      x: zone.x + (approach.x - zone.x) * 0.62,
      y: zone.y + (approach.y - zone.y) * 0.62,
    };
  }
  if (stand === 'perimeter') {
    const ang = ((self.id % 8) / 8) * Math.PI * 2;
    return { x: zone.x + Math.cos(ang) * 120, y: zone.y + Math.sin(ang) * 120 };
  }
  return { x: zone.x, y: zone.y };
};

export const sixShouldReconsider = (
  action: TacticalAction,
  self: { x: number; y: number; team: TeamId },
  zones: readonly SixZoneFact[] = sixZoneFacts(),
): boolean => {
  if (matchFormatOf() !== '6v6') {
    return false;
  }
  if (action === 'contest_objective') {
    return false;
  }
  const foe = foeOf(self.team);
  for (const zone of zones) {
    if (zone.phase !== 'active') {
      continue;
    }
    const enemyTaking = zone.owner === foe && zone.progress >= 0.22 && zone.secured !== self.team;
    const oursHot = (zone.secured === self.team || zone.owner === self.team) && zone.contested;
    const far = hypot(self.x, self.y, zone.x, zone.y) > zone.radius + 180;
    if ((enemyTaking || oursHot) && far && (action === 'chase' || action === 'attack' || action === 'flank' || action === 'farm_minions' || action === 'advance' || action === 'search_for_target')) {
      return true;
    }
  }
  return false;
};

const FIGHT_ROWS: ReadonlySet<TacticalAction> = new Set(['attack', 'chase', 'flank', 'assist_ally', 'intercept']);

/** Fold the 6v6 role into the existing scored actions. 3v3 returns untouched. */
export const applySixRoster = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  write: Write,
): number => {
  if (matchFormatOf() !== '6v6' || situation.kind !== 'hero' || situation.self.kind !== 'hero') {
    situation.sixPlan = undefined;
    return count;
  }
  const zones = sixZoneFacts();
  if (zones.length === 0) {
    situation.sixPlan = undefined;
    return count;
  }
  const now = situation.now ?? 0;
  const choice = chooseSixRole({
    self: { ...situation.self, stance: situation.kit?.stance },
    allies: situation.allies,
    enemies: situation.enemies,
    zones,
    intents: sixIntents(now, situation.self.id),
    personality: situation.personality,
    teamScore: situation.teamScore,
    remainingMs: situation.remainingMs,
    now,
    crate: situation.environment?.crate,
  });
  situation.sixPlan = {
    job: choice.job,
    zoneId: choice.zoneId,
    stand: choice.stand,
    x: choice.x,
    y: choice.y,
    radius: choice.radius,
    debug: choice.debug,
  };

  const fight = readFight(situation.self, situation.allies, situation.enemies);
  const extra = fight.allies - Math.max(1, fight.enemies);
  if (!fight.selfIn && !fight.losing && (extra >= 1 || fight.allies >= 4)) {
    const cut = extra >= 3 || fight.allies >= 5 ? 36 : extra >= 2 || fight.allies >= 4 ? 24 : 12;
    for (let i = 0; i < count; i += 1) {
      const row = out[i];
      if (!FIGHT_ROWS.has(row.action) || row.action === 'finish_target') {
        continue;
      }
      const closeFinish = row.action === 'attack' && row.reason.includes('finish');
      if (closeFinish) {
        continue;
      }
      row.score -= cut + situation.personality.independence * 6;
    }
  }

  if (choice.job === 'farm' && situation.environment?.crate) {
    return write(out, count, 'farm_minions', choice.score, `FARM CRATE | ${choice.debug}`, -1);
  }
  if (choice.zoneId && (choice.job === 'capture' || choice.job === 'defend' || choice.job === 'contest' || choice.job === 'rotate' || choice.job === 'support')) {
    const prefix =
      choice.job === 'capture'
        ? 'CAPTURE'
        : choice.job === 'defend'
          ? 'DEFEND'
          : choice.job === 'contest'
            ? 'CONTEST'
            : choice.job === 'support'
              ? 'SUPPORT'
              : 'ROTATE';
    return write(out, count, 'contest_objective', choice.score, `${prefix} ${choice.zoneId} | ${choice.debug}`);
  }
  return count;
};
