import { ARENA } from '../../config/arena';
import { WAR_SCORE } from '../../config/score';
import { isShadowDry } from './kitProfile';
import type {
  CombatantView,
  GamePlan,
  KitProfile,
  OpeningPlan,
  Personality,
  Situation,
  StrategicState,
} from './types';

type OpeningWeight = { plan: OpeningPlan; weight: number };

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const hash01 = (seed: string, salt: number): number => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const pickWeighted = (items: OpeningWeight[], roll: number): OpeningPlan => {
  const usable = items.filter((item) => item.weight > 0.02);
  const list = usable.length > 0 ? usable : items;
  let total = 0;
  for (const item of list) {
    total += item.weight;
  }
  let cursor = roll * total;
  for (const item of list) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.plan;
    }
  }
  return list[0]?.plan ?? 'controlled_advance';
};

const allyHeroesOf = (situation: Situation): CombatantView[] =>
  situation.allies.filter((unit) => unit.kind === 'hero');

const visibleEnemyHeroes = (situation: Situation): CombatantView[] =>
  situation.enemies.filter((unit) => unit.kind === 'hero' && unit.visible);

const centroid = (units: CombatantView[], fallback: { x: number; y: number }): { x: number; y: number } => {
  if (units.length === 0) {
    return fallback;
  }
  let x = 0;
  let y = 0;
  for (const unit of units) {
    x += unit.x;
    y += unit.y;
  }
  return { x: x / units.length, y: y / units.length };
};

const openingMenu = (
  kit: KitProfile,
  personality: Personality,
  slot: number,
): OpeningWeight[] => {
  const ranged = kit.stance === 'ranged' || kit.stance === 'support';
  const lane = slot % 3;
  const rush = ranged
    ? Math.max(0, (personality.aggression - 0.58) * 0.16 - personality.caution * 0.1)
    : 0.16 + personality.aggression * 0.22 - personality.caution * 0.08;
  const flank = 0.1 + personality.flankTendency * (ranged ? 0.1 : 0.2) + (kit.wantsFlank ? 0.08 : 0);
  const hold = ranged
    ? 0.16 + personality.caution * 0.18 + personality.patience * 0.08
    : 0.05 + personality.caution * 0.1;
  const wait = 0.08 + personality.teamwork * 0.14 + (ranged ? 0.06 : 0);
  const poke = ranged
    ? 0.2 + personality.patience * 0.1 + (kit.wantsPoke ? 0.08 : 0)
    : personality.caution * 0.02;
  const controlled = 0.16 + (ranged ? 0.04 : 0.08);
  const behind = 0.1 + personality.patience * 0.08;
  const ally = 0.1 + personality.teamwork * 0.12;
  const scout = 0.08 + personality.caution * 0.12;
  const wide = 0.06 + personality.independence * 0.12 + (kit.wantsFlank ? 0.06 : 0);
  const items: OpeningWeight[] = [
    { plan: 'rush_center', weight: rush * (lane === 1 ? 1.15 : 0.75) },
    { plan: 'controlled_advance', weight: controlled * (lane === 1 ? 1.2 : 0.9) },
    { plan: 'hold_near_spawn', weight: hold * (lane === 2 ? 1.25 : 0.85) },
    { plan: 'advance_behind_minions', weight: behind },
    { plan: 'flank_left', weight: flank * (lane === 0 ? 1.45 : 0.55) },
    { plan: 'flank_right', weight: flank * (lane === 2 ? 1.45 : 0.55) },
    { plan: 'wide_rotation', weight: wide * (lane === 0 || lane === 2 ? 1.2 : 0.6) },
    { plan: 'defensive_hold', weight: hold * 0.7 + (kit.wantsProtect ? 0.08 : 0) },
    { plan: 'stay_back_poke', weight: poke * (lane === 1 ? 0.85 : 1.1) },
    { plan: 'move_to_ally', weight: ally },
    { plan: 'scout_cautious', weight: scout },
    { plan: 'indirect_center', weight: 0.08 + personality.independence * 0.08 },
    { plan: 'wait_for_team', weight: wait * 0.35 },
  ];
  return items;
};

const ownThirdX = (team: CombatantView['team']): number =>
  team === 'alpha' ? ARENA.width * 0.38 : ARENA.width * 0.62;

const backX = (team: CombatantView['team'], homeX: number): number =>
  team === 'alpha' ? homeX + 160 : homeX - 160;

const clampArena = (x: number, y: number): { x: number; y: number } => ({
  x: clamp(x, 120, ARENA.width - 120),
  y: clamp(y, 120, ARENA.height - 120),
});

export const openingAnchor = (
  plan: OpeningPlan,
  self: CombatantView,
  homeX: number,
  homeY: number,
  allies: CombatantView[],
  kit: KitProfile,
): { x: number; y: number } => {
  const midX = ARENA.width / 2;
  const third = ownThirdX(self.team);
  const heroes = allies.filter((unit) => unit.kind === 'hero');
  const minions = allies.filter((unit) => unit.kind === 'minion');
  const pack = centroid(minions, { x: third, y: self.y });
  const team = centroid(heroes, { x: homeX, y: homeY });
  const leftY = clamp(self.y - 240, 160, ARENA.height - 160);
  const rightY = clamp(self.y + 240, 160, ARENA.height - 160);
  const spacing = kit.stance === 'ranged' || kit.stance === 'support' ? -70 : 40;
  const forward = self.team === 'alpha' ? 1 : -1;
  switch (plan) {
    case 'rush_center':
      return clampArena(third + forward * 70, homeY + (self.id % 3 - 1) * 36);
    case 'controlled_advance':
      return clampArena(third, self.y);
    case 'hold_near_spawn':
      return clampArena(backX(self.team, homeX), homeY);
    case 'advance_behind_minions':
      return clampArena(pack.x - forward * 70, pack.y);
    case 'flank_left':
      return clampArena(third + forward * 40, leftY);
    case 'flank_right':
      return clampArena(third + forward * 40, rightY);
    case 'wide_rotation':
      return clampArena(midX - forward * 80, self.y < ARENA.laneY.mid ? ARENA.laneY.top : ARENA.laneY.bottom);
    case 'defensive_hold':
      return clampArena(backX(self.team, homeX) + forward * 40, homeY);
    case 'stay_back_poke':
      return clampArena(third - forward * 90, self.y);
    case 'move_to_ally':
      return clampArena(team.x + forward * spacing, team.y + (self.id % 2 === 0 ? 36 : -36));
    case 'scout_cautious':
      return clampArena(homeX + forward * 220, self.y + (self.id % 2 === 0 ? 50 : -50));
    case 'indirect_center':
      return clampArena(third + forward * 50, self.y < ARENA.laneY.mid ? ARENA.laneY.top : ARENA.laneY.bottom);
    case 'wait_for_team':
      return clampArena(third - forward * 40, team.y + 28);
    default:
      return clampArena(third, self.y);
  }
};

export const formationOffset = (
  kit: KitProfile,
  personality: Personality,
  flankSign: number,
): { x: number; y: number } => {
  const side = 28 + personality.independence * 36;
  if (kit.stance === 'ranged') {
    return { x: -70 - personality.preferredDistance * 24, y: side * flankSign };
  }
  if (kit.stance === 'support') {
    return { x: -48, y: 42 * flankSign };
  }
  if (kit.wantsFlank) {
    return { x: 18, y: (70 + personality.flankTendency * 40) * flankSign };
  }
  return { x: 36 + personality.aggression * 18, y: 16 * flankSign };
};

const openingDuration = (personality: Personality, slot: number): number =>
  4800 + personality.patience * 2200 + (slot % 7) * 180;

const shouldAbandonOpening = (situation: Situation): string | undefined => {
  const foes = visibleEnemyHeroes(situation);
  const p = situation.personality;
  if (situation.projectile?.willHit) {
    return 'shot incoming';
  }
  if (situation.lastSurvivor) {
    return 'last survivor';
  }
  if (situation.self.hpRatio < p.retreatHp) {
    return 'hurt';
  }
  if (foes.length >= 3 && allyHeroesOf(situation).length === 0) {
    return 'outnumbered';
  }
  const threatened = situation.allies.find(
    (ally) => ally.kind === 'hero' && ally.hpRatio < 0.32 && ally.recentlyHit,
  );
  if (threatened && p.protectionInstinct > 0.42) {
    return 'ally in trouble';
  }
  return undefined;
};

const nextState = (situation: Situation, kit: KitProfile, opening: OpeningPlan, prev: StrategicState): StrategicState => {
  const foes = visibleEnemyHeroes(situation);
  const p = situation.personality;
  if (situation.projectile?.willHit) {
    return 'reposition';
  }
  if (situation.self.hpRatio < p.retreatHp || (situation.lastSurvivor && foes.length >= 2)) {
    return situation.self.hpRatio < 0.22 ? 'retreat' : 'recover';
  }
  if (situation.isolated && allyHeroesOf(situation).length > 0 && (p.teamwork > 0.4 || situation.self.hpRatio < 0.55 || (situation.teamScore && situation.teamScore.self + WAR_SCORE.heroKill < situation.teamScore.enemy))) {
    return 'regroup';
  }
  if (foes.length === 0) {
    if (situation.objective && situation.objective.urgency >= 0.58) {
      return 'advance';
    }
    if (prev === 'opening' && situation.now !== undefined && situation.plan && situation.now < situation.plan.until) {
      return 'opening';
    }
    if (p.caution > 0.55 || kit.stance === 'ranged') {
      return situation.allies.some((ally) => ally.kind === 'hero') ? 'patrol' : 'search';
    }
    return 'search';
  }
  const nearest = foes.reduce((best, enemy) => {
    const d = Math.hypot(enemy.x - situation.self.x, enemy.y - situation.self.y);
    return !best || d < best.d ? { enemy, d } : best;
  }, undefined as { enemy: CombatantView; d: number } | undefined);
  const allyNeed = situation.allies.find((ally) => ally.kind === 'hero' && ally.hpRatio < 0.36 && ally.recentlyHit);
  if (situation.hasAllySupport) {
    const mode = situation.supportMode;
    if (mode === 'save' || mode === 'support') {
      return 'protect';
    }
    if (mode === 'mix') {
      return nearest && nearest.d <= kit.comfortMax ? 'poke' : 'support';
    }
  } else if (allyNeed && kit.wantsProtect) {
    return 'protect';
  }
  if (nearest && nearest.enemy.hpRatio < 0.2 && p.opportunism > 0.35) {
    return 'finish';
  }
  if (isShadowDry(situation.self.heroId, situation.self) && foes.length > 0) {
    return nearest && nearest.d < 220 ? 'reposition' : 'recover';
  }
  if (nearest && kit.stance === 'ranged' && nearest.d < kit.comfortMin) {
    return 'reposition';
  }
  if (opening === 'flank_left' || opening === 'flank_right' || opening === 'wide_rotation' || kit.wantsFlank) {
    if (nearest && nearest.d > kit.preferredRange * 0.8 && p.flankTendency > 0.45) {
      return 'flank';
    }
  }
  if (kit.stance === 'ranged' || kit.stance === 'support' || opening === 'stay_back_poke') {
    if (
      kit.wantsInitiate &&
      nearest &&
      nearest.d > kit.comfortMin &&
      nearest.d < kit.comfortMax * 1.08 &&
      situation.self.hpRatio > 0.38
    ) {
      return 'engage';
    }
    return nearest && nearest.d <= kit.comfortMax ? 'poke' : 'hold';
  }
  if (opening === 'hold_near_spawn' || opening === 'defensive_hold' || opening === 'wait_for_team') {
    return foes.length > 0 ? 'hold' : 'patrol';
  }
  if (allyNeed) {
    return 'support';
  }
  return kit.wantsInitiate ? 'engage' : 'advance';
};

export class GamePlanController {
  opening: OpeningPlan;
  state: StrategicState = 'opening';
  reason = 'opening';
  until = 0;
  anchorX: number;
  anchorY: number;
  savedUlt = false;
  reactingToShot = false;
  regrouping = false;
  private readonly slot: number;
  private readonly homeX: number;
  private readonly homeY: number;

  constructor(seed: string, slot: number, kit: KitProfile, personality: Personality, homeX: number, homeY: number) {
    this.slot = slot;
    this.homeX = homeX;
    this.homeY = homeY;
    this.opening = pickWeighted(
      openingMenu(kit, personality, slot),
      hash01(seed, 41 + slot) * 0.34 + Math.random() * 0.66,
    );
    this.anchorX = homeX;
    this.anchorY = homeY;
    this.reason = this.opening;
  }

  snapshot(preferredRange: number): GamePlan {
    return {
      state: this.state,
      opening: this.opening,
      reason: this.reason,
      until: this.until,
      anchorX: this.anchorX,
      anchorY: this.anchorY,
      preferredRange,
      savedUlt: this.savedUlt,
      reactingToShot: this.reactingToShot,
      regrouping: this.regrouping,
    };
  }

  sync(now: number, situation: Situation, kit: KitProfile, flankSign: number): GamePlan {
    if (this.until === 0) {
      this.until = now + openingDuration(situation.personality, this.slot);
      const point = openingAnchor(this.opening, situation.self, this.homeX, this.homeY, situation.allies, kit);
      this.anchorX = point.x;
      this.anchorY = point.y;
      this.state = 'opening';
      this.reason = this.opening;
    }

    this.reactingToShot = Boolean(situation.projectile?.willHit);
    const abandon = this.state === 'opening' ? shouldAbandonOpening(situation) : undefined;
    if (abandon) {
      this.state = nextState(situation, kit, this.opening, this.state);
      this.reason = abandon;
      this.until = now + 1600 + situation.personality.thinkJitterMs;
    } else if (now >= this.until || (this.state === 'opening' && visibleEnemyHeroes(situation).length > 0 && now > this.until - 1800)) {
      const prev = this.state;
      this.state = nextState(situation, kit, this.opening, prev);
      if (this.state !== prev) {
        this.reason = `shift:${prev}->${this.state}`;
        this.until = now + 2200 + (this.slot % 5) * 120;
      } else {
        this.until = now + 1800;
      }
    } else if (this.state !== 'opening') {
      const updated = nextState(situation, kit, this.opening, this.state);
      if (updated !== this.state && this.priority(updated) >= this.priority(this.state)) {
        this.reason = `adapt:${this.state}->${updated}`;
        this.state = updated;
        this.until = now + 1400 + situation.personality.thinkJitterMs;
      }
    }

    this.regrouping = this.state === 'regroup';
    this.refreshAnchor(situation, kit, flankSign);
    const plan = this.snapshot(kit.preferredRange);
    situation.plan = plan;
    return plan;
  }

  markUltSaved(saved: boolean): void {
    this.savedUlt = saved;
  }

  private priority(state: StrategicState): number {
    switch (state) {
      case 'retreat':
      case 'reposition':
        return 9;
      case 'recover':
        return 8;
      case 'protect':
      case 'support':
        return 7;
      case 'finish':
      case 'engage':
        return 6;
      case 'regroup':
        return 5;
      case 'flank':
      case 'poke':
      case 'hold':
        return 4;
      default:
        return 2;
    }
  }

  private refreshAnchor(situation: Situation, kit: KitProfile, flankSign: number): void {
    const self = situation.self;
    const heroes = allyHeroesOf(situation);
    const team = centroid(heroes, { x: this.homeX, y: this.homeY });
    const forward = self.team === 'alpha' ? 1 : -1;
    const offset = formationOffset(kit, situation.personality, flankSign);
    if (this.state === 'opening') {
      const point = openingAnchor(this.opening, self, this.homeX, this.homeY, situation.allies, kit);
      this.anchorX = point.x;
      this.anchorY = point.y;
      return;
    }
    if (this.state === 'regroup' || this.state === 'support' || this.state === 'protect') {
      this.anchorX = team.x + forward * offset.x;
      this.anchorY = team.y + offset.y;
      return;
    }
    if (this.state === 'patrol' || this.state === 'search' || this.state === 'hold') {
      const holdX = ownThirdX(self.team) + forward * (kit.stance === 'ranged' ? -40 : 50);
      this.anchorX = holdX;
      this.anchorY = clamp(self.y + offset.y, 140, ARENA.height - 140);
      return;
    }
    if (this.state === 'flank') {
      this.anchorX = ownThirdX(self.team) + forward * 60;
      this.anchorY = this.opening === 'flank_left' ? clamp(self.y - 220, 150, ARENA.height - 150) : clamp(self.y + 220, 150, ARENA.height - 150);
    }
  }
}

export const pickOpeningForTest = (
  seed: string,
  slot: number,
  kit: KitProfile,
  personality: Personality,
): OpeningPlan => pickWeighted(openingMenu(kit, personality, slot), hash01(seed, 41 + slot));
