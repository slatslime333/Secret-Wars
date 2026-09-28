import { matchFormatOf } from '../../config/arena';
import type { TeamId } from '../../config/hero';
import type { SixZoneFact } from '../../match/objectives/sixZoneBoard';
import { sixZoneFacts } from '../../match/objectives/sixZoneBoard';
import type { KitStance, Personality, ScoredAction, Situation, TacticalAction } from './types';
import { NEUTRAL_PERSONALITY } from './types';

export type SixJob = 'capture' | 'defend' | 'contest' | 'fight' | 'flank' | 'farm' | 'rotate' | 'support' | 'regroup';

/** Explicit 6v6 control-zone read. Free means nobody owns the take. */
export type SixZoneState = 'free' | 'friendly' | 'threatened' | 'contested' | 'handled' | 'cooldown';

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
  state?: SixZoneState;
  dist: number;
  occupants: number;
  approach: number;
  recommended: number;
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
  state: SixZoneState;
  job: SixJob;
  value: number;
  committed: number;
  occupants: number;
  approaching: SixBody[];
  stand: SixStand;
  /** Still short of the bodies this state actually wants. */
  short: boolean;
  recommended: number;
  dist: number;
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

type ZoneFlags = {
  foe: ReturnType<typeof foeOf>;
  melee: boolean;
  ranged: boolean;
  flanker: boolean;
  support: boolean;
  cautious: boolean;
  late: boolean;
  behind: boolean;
  selfIn: boolean;
  fightHandled: boolean;
  nearestD: number;
  personality: Personality;
};

const heroVisible = (body: SixBody): boolean => (body.kind ?? 'hero') === 'hero' && body.visible !== false;

/**
 * Free / handled / threatened / contested / friendly.
 * A free zone with nobody committed stays a capture. A safe claim drops to handled.
 */
const readControlZone = (
  fact: SixZoneFact,
  self: SixBody,
  allies: readonly SixBody[],
  enemies: readonly SixBody[],
  intents: readonly SixIntentPost[],
  flags: ZoneFlags,
): ZoneRead | undefined => {
  if (fact.phase !== 'active') {
    return undefined;
  }
  const committed = committedIds(fact, allies, intents);
  const dist = hypot(self.x, self.y, fact.x, fact.y);
  const onZone = dist <= fact.radius + 70;
  const holding = enemies.filter(
    (enemy) => heroVisible(enemy) && hypot(enemy.x, enemy.y, fact.x, fact.y) <= fact.radius + 80,
  );
  const approaching = enemies.filter(
    (enemy) =>
      heroVisible(enemy) &&
      hypot(enemy.x, enemy.y, fact.x, fact.y) < 640 &&
      hypot(enemy.x, enemy.y, fact.x, fact.y) > fact.radius &&
      movingToward(enemy, fact.x, fact.y),
  );
  const ours = fact.secured === self.team;
  const enemyChannel = fact.owner === flags.foe && fact.progress > 0.04 && fact.secured !== self.team && fact.secured !== flags.foe;
  const weChannel = fact.owner === self.team && fact.progress > 0.04 && !fact.secured;
  let closerFriend = false;
  for (const ally of allies) {
    if (!committed.has(ally.id)) {
      continue;
    }
    if (hypot(ally.x, ally.y, fact.x, fact.y) + 12 < dist) {
      closerFriend = true;
    }
  }
  const claimed = committed.size > 0 && (!onZone || closerFriend);
  let state: SixZoneState;
  if (holding.length > 0 || fact.contested) {
    state = 'contested';
  } else if (enemyChannel && fact.progress >= 0.12) {
    state = 'threatened';
  } else if (approaching.length > 0) {
    state = 'threatened';
  } else if (ours) {
    state = 'friendly';
  } else if (claimed || (weChannel && committed.size > 0 && !onZone)) {
    state = 'handled';
  } else {
    state = 'free';
  }
  if (state === 'contested' && weChannel && fact.progress >= 0.82 && holding.length === 0 && approaching.length === 0) {
    state = 'handled';
  }

  let recommended = 1;
  if (state === 'threatened') {
    recommended = Math.min(4, Math.max(2, approaching.length + (holding.length > 0 ? holding.length : 0)));
    if (approaching.length >= 2) {
      recommended = Math.min(4, approaching.length + 1);
    }
  } else if (state === 'contested') {
    if (holding.length >= committed.size + 1) {
      recommended = holding.length + 1;
    } else if (holding.length >= 2 && committed.size >= holding.length) {
      recommended = holding.length;
    } else {
      recommended = Math.max(2, holding.length + 1);
    }
  }

  const short = (state === 'threatened' || state === 'contested') && committed.size < recommended;
  let job: SixJob = 'capture';
  let value = 0;
  if (state === 'free') {
    job = 'capture';
    value = 98 - dist * 0.05;
    if (flags.cautious) {
      value += 6;
    }
    if (dist > 1100) {
      value *= 0.45;
    }
    if (flags.selfIn && !flags.fightHandled && flags.nearestD < 240) {
      value *= 0.42;
    }
    if (onZone) {
      value += 8;
    }
  } else if (state === 'handled') {
    job = 'capture';
    value = 7;
  } else if (state === 'friendly') {
    job = 'defend';
    value = 44 - dist / 160;
    if (flags.late) {
      value += 8;
    }
    if (committed.size === 0 && dist < fact.radius + 50) {
      value += 28;
    } else if (committed.size === 1) {
      value = 36 - dist / 180;
      if (dist > 280) {
        value *= 0.35;
      }
    } else if (committed.size >= 2) {
      value *= 0.12;
    }
    if (dist > 1000) {
      value *= 0.4;
    }
  } else if (state === 'threatened') {
    if ((ours || weChannel) && onZone) {
      job = 'defend';
    } else if (committed.size > 0 || ours || weChannel) {
      job = 'rotate';
    } else if (enemyChannel) {
      job = 'contest';
    } else {
      job = 'capture';
    }
    value = 86 + approaching.length * 8 + holding.length * 10 - dist * 0.04;
    if (committed.size >= recommended) {
      value *= 0.22;
    }
    if (flags.support && committed.size > 0) {
      value += 6 + flags.personality.protectionInstinct * 4;
    }
  } else {
    job = 'contest';
    const losing = holding.length >= committed.size + 1;
    value = 92 + fact.progress * 20 + Math.max(0, holding.length - committed.size) * 12 - dist * 0.032;
    if (losing) {
      value += 18;
    }
    if (holding.length >= 2) {
      value += 12;
    }
    if (flags.melee || flags.personality.aggression > 0.6) {
      value += 6;
    }
    if (!losing && committed.size >= recommended && committed.size >= 2) {
      value *= 0.18;
    }
  }
  if (
    (state === 'free' || (state === 'friendly' && committed.size === 0)) &&
    (self.id + (flags.personality.independence > 0.55 ? 1 : 0)) % 2 === (fact.id === 'A' ? 0 : 1)
  ) {
    value += 11;
  }
  if (flags.behind && flags.late && (state === 'free' || state === 'contested' || state === 'threatened')) {
    value += 10;
  }

  let stand: SixStand = 'inside';
  if (state === 'threatened' && approaching.length > 0 && (flags.flanker || flags.ranged || committed.size >= 1)) {
    stand = 'intercept';
  } else if (state === 'friendly' || state === 'handled') {
    stand = committed.size === 0 && !flags.ranged ? 'inside' : 'perimeter';
  } else if (state === 'free') {
    stand = flags.ranged ? 'perimeter' : 'inside';
  } else if (flags.flanker || flags.ranged) {
    stand = 'intercept';
  }
  if (flags.flanker && approaching.length > 0) {
    stand = 'intercept';
  }
  return {
    fact,
    state,
    job,
    value,
    committed: committed.size,
    occupants: holding.length,
    approaching,
    stand,
    short,
    recommended,
    dist,
  };
};

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
    const read = readControlZone(fact, self, input.allies, input.enemies, intents, {
      foe,
      melee,
      ranged,
      flanker,
      support,
      cautious,
      late,
      behind,
      selfIn: fight.selfIn,
      fightHandled: fight.handled,
      nearestD,
      personality,
    });
    if (read) {
      zones.push(read);
    }
  }
  const localFree = zones.find((zone) => zone.state === 'free' && zone.committed === 0 && zone.dist < 280);
  const emergency = zones.find((zone) => (zone.state === 'contested' || zone.state === 'threatened') && zone.short);
  if (localFree && emergency && emergency.dist > localFree.dist + 450 && emergency.occupants <= emergency.committed + 1) {
    localFree.value = Math.max(localFree.value, emergency.value + 8);
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

  const openFree = Boolean(picked && picked.state === 'free' && picked.committed === 0 && picked.value > 16);
  const critical = Boolean(picked && picked.short && picked.value > 48 && (picked.state === 'contested' || picked.state === 'threatened'));
  if (critical || openFree) {
    farm = Math.min(farm, openFree && !critical ? farm : 10);
    if (openFree && !critical && farm < (picked?.value ?? 0) + 18) {
      farm = Math.min(farm, 10);
    }
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
  const handledNote = zones.find((zone) => zone.state === 'handled');

  if (picked && picked.state !== 'handled' && picked.value >= score && picked.value > 16) {
    job = picked.job;
    score = picked.value;
    zoneId = picked.fact.id;
    stand = picked.stand;
    const point = sixStandPoint(self, picked.fact, stand, picked.approaching[0]);
    x = point.x;
    y = point.y;
    radius = picked.fact.radius;
    alliesOnZone = picked.committed;
  } else if (picked) {
    rejected.push(picked.state === 'handled' ? `ZONE ${picked.fact.id} ALREADY HANDLED` : `zone ${picked.fact.id} ${Math.round(picked.value)}`);
  }
  if (farm > score && farm > 18 && !critical && !openFree) {
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
    if (!zoneId && picked && picked.state === 'free') {
      job = 'capture';
      zoneId = picked.fact.id;
      score = Math.max(score, picked.value);
      stand = picked.stand;
      const point = sixStandPoint(self, picked.fact, stand, picked.approaching[0]);
      x = point.x;
      y = point.y;
      radius = picked.fact.radius;
    }
  }

  const label =
    job === 'farm'
      ? 'FARM CRATE'
      : job === 'fight'
        ? 'FIGHT'
        : job === 'flank'
          ? 'FLANK'
          : `${job.toUpperCase()} ${zoneId ?? ''}`.trim();
  const focus = zoneId ? zones.find((zone) => zone.fact.id === zoneId) ?? picked : picked;
  const approachNote = focus && focus.approaching.length > 0 ? String(focus.approaching.length) : 'none';
  const stateName = focus ? focus.state.toUpperCase() : 'NONE';
  const decision =
    focus?.state === 'handled' && job !== 'capture' && job !== 'contest' && job !== 'defend' && job !== 'rotate'
      ? 'IGNORE'
      : label;
  const reasonLine =
    decision === 'IGNORE'
      ? 'REASON: ALREADY HANDLED'
      : fightHandled && (job === 'capture' || job === 'rotate')
        ? `fight handled ${fight.allies}v${fight.enemies}`
        : openFree && (job === 'capture' || job === 'rotate')
          ? 'nobody is taking it'
          : rejected.length > 0
            ? `reject ${rejected.join('; ')}`
            : '';
  const debug = [
    focus?.state === 'free' ? `FREE ZONE ${focus.fact.id}` : `ZONE ${focus?.fact.id ?? '-'} ${stateName}`,
    `distance: ${Math.round(focus?.dist ?? 0)}`,
    `friendly commitments: ${focus?.committed ?? 0}`,
    `enemy occupants: ${focus?.occupants ?? 0}`,
    `enemy approach: ${approachNote}`,
    `combat value: ${Math.round(combat)}`,
    `objective value: ${Math.round(focus?.value ?? 0)}`,
    `DECISION: ${decision}`,
    reasonLine,
    handledNote && decision !== 'IGNORE' ? `also handled ${handledNote.fact.id}` : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');

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
    state: focus?.state,
    dist: focus?.dist ?? 0,
    occupants: focus?.occupants ?? 0,
    approach: focus?.approaching.length ?? 0,
    recommended: focus?.recommended ?? 1,
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

export type SixReconsiderContext = {
  intents?: readonly SixIntentPost[];
  allies?: readonly SixBody[];
  enemies?: readonly SixBody[];
  intentZone?: 'A' | 'B';
};

const CHASE_ACTIONS: ReadonlySet<TacticalAction> = new Set([
  'chase',
  'attack',
  'flank',
  'farm_minions',
  'advance',
  'search_for_target',
]);

export const sixShouldReconsider = (
  action: TacticalAction,
  self: { x: number; y: number; team: TeamId; id?: number; attackRange?: number },
  zones: readonly SixZoneFact[] = sixZoneFacts(),
  context: SixReconsiderContext = {},
): boolean => {
  if (matchFormatOf() !== '6v6') {
    return false;
  }
  const foe = foeOf(self.team);
  const intents = context.intents ?? [];
  const allies = context.allies ?? [];
  const enemies = context.enemies ?? [];
  const engaged = enemies.some(
    (enemy) => heroVisible(enemy) && hypot(enemy.x, enemy.y, self.x, self.y) < (self.attackRange ?? 70) * 1.25,
  );
  for (const zone of zones) {
    if (zone.phase !== 'active') {
      continue;
    }
    const dist = hypot(self.x, self.y, zone.x, zone.y);
    const holding = enemies.filter((enemy) => heroVisible(enemy) && hypot(enemy.x, enemy.y, zone.x, zone.y) <= zone.radius + 80);
    const approaching = enemies.filter(
      (enemy) =>
        heroVisible(enemy) &&
        hypot(enemy.x, enemy.y, zone.x, zone.y) < 640 &&
        hypot(enemy.x, enemy.y, zone.x, zone.y) > zone.radius &&
        movingToward(enemy, zone.x, zone.y),
    );
    const committed = committedIds(zone, allies, intents);
    const enemyTaking = zone.owner === foe && zone.progress >= 0.22 && zone.secured !== self.team;
    const oursHot = (zone.secured === self.team || zone.owner === self.team) && (zone.contested || holding.length > 0);
    const far = dist > zone.radius + 180;
    const chasey = CHASE_ACTIONS.has(action);
    if ((enemyTaking || oursHot || (approaching.length > 0 && (zone.secured === self.team || committed.size > 0))) && far && chasey) {
      return true;
    }
    if (holding.length >= Math.max(2, committed.size + 1) && far && chasey) {
      return true;
    }
    const free =
      zone.secured !== self.team &&
      !enemyTaking &&
      !zone.contested &&
      holding.length === 0 &&
      approaching.length === 0 &&
      committed.size === 0;
    if (free && dist < 720 && chasey && !engaged) {
      return true;
    }
    if (action === 'contest_objective' && context.intentZone === zone.id) {
      const yieldToClaim = committed.size > 0 && dist > zone.radius + 100 && holding.length === 0 && approaching.length === 0 && !enemyTaking;
      if (yieldToClaim) {
        return true;
      }
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

  const zoneFact = choice.zoneId ? zones.find((zone) => zone.id === choice.zoneId) : undefined;
  const needsHelp =
    Boolean(zoneFact) &&
    (choice.state === 'threatened' || choice.state === 'contested') &&
    choice.alliesOnZone < choice.recommended;
  const takeFree = choice.state === 'free' && choice.job === 'capture' && choice.alliesOnZone === 0 && Boolean(zoneFact) && choice.dist < 980;
  let posted = choice.score;
  if (zoneFact && (takeFree || needsHelp)) {
    const lifted = liftOverDistantFights(out, count, situation, zoneFact, takeFree ? 'free' : 'help');
    if (!(takeFree && lifted.engaged)) {
      posted = Math.max(posted, lifted.peak + 32);
    }
  }

  if (choice.job === 'farm' && situation.environment?.crate) {
    return write(out, count, 'farm_minions', posted, `FARM CRATE | ${choice.debug}`, -1);
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
    return write(out, count, 'contest_objective', posted, `${prefix} ${choice.zoneId} | ${choice.debug}`);
  }
  return count;
};

/** A free or short-handed zone has to clear the pick band, not just tie a distant attack row. */
const liftOverDistantFights = (
  out: ScoredAction[],
  count: number,
  situation: Situation,
  zone: { x: number; y: number; radius: number },
  mode: 'free' | 'help',
): { peak: number; engaged: boolean } => {
  const self = situation.self;
  let peak = 0;
  let engaged = false;
  for (let i = 0; i < count; i += 1) {
    const row = out[i];
    const fightish = FIGHT_ROWS.has(row.action) || row.action === 'advance' || row.action === 'search_for_target';
    if (!fightish || row.action === 'finish_target') {
      continue;
    }
    if (row.action === 'attack' && row.reason.includes('finish')) {
      continue;
    }
    const enemy = situation.enemies.find((unit) => unit.id === row.targetId);
    const enemyDist = enemy ? hypot(self.x, self.y, enemy.x, enemy.y) : 9999;
    const onZone = Boolean(enemy && hypot(enemy.x, enemy.y, zone.x, zone.y) < zone.radius + 100);
    const inFace = Boolean(
      enemy && enemyDist < (self.attackRange || 70) * 1.2 && (self.recentlyHit || self.attacking || enemy.attacking),
    );
    if (inFace) {
      engaged = true;
      peak = Math.max(peak, row.score);
      continue;
    }
    if (mode === 'help' && onZone) {
      peak = Math.max(peak, row.score);
      continue;
    }
    peak = Math.max(peak, row.score);
    if (enemyDist > 240) {
      row.score -= 36;
    }
  }
  return { peak, engaged };
};
