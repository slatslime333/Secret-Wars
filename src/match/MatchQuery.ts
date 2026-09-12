import { ARENA, nearestLane, type LaneId } from '../config/arena';
import type { TeamId } from '../config/hero';
import type { MatchSnapshot } from './MatchManager';
import type { TeamScore } from './ScoreManager';
import type { HeroRuntime } from './HeroRuntime';
import type { MinionWorld } from '../minions/MinionWorld';
import type { AbilitySlotState } from '../heroes/abilities/types';

export type HeroQuery = {
  instanceId: string;
  heroId: string;
  displayName: string;
  role: string;
  team: TeamId;
  lane: LaneId;
  spawnLane: LaneId;
  player: boolean;
  alive: boolean;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNext: number;
  attackDamage: number;
  defense: number;
  moveSpeed: number;
  abilities: AbilitySlotState[];
};

export type MinionQuery = {
  team: TeamId;
  lane: LaneId;
  kind: string;
  waveId: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  distanceTo: (x: number, y: number) => number;
};

export type LanePressure = {
  lane: LaneId;
  friendly: number;
  enemy: number;
};

export type MatchGameState = {
  match: MatchSnapshot;
  score: TeamScore;
  self: HeroQuery | null;
  allies: HeroQuery[];
  enemies: HeroQuery[];
  emptyAllySlots: { team: TeamId; lane: LaneId }[];
  minions: MinionQuery[];
  lanes: LanePressure[];
  nearbyAllies: HeroQuery[];
  nearbyEnemies: HeroQuery[];
  fightNearby: boolean;
  outnumbered: boolean;
};

const NEAR = 220;

const toHero = (runtime: HeroRuntime, now: number): HeroQuery => ({
  instanceId: runtime.instanceId,
  heroId: runtime.heroId,
  displayName: runtime.body.stats.displayName,
  role: runtime.body.stats.role,
  team: runtime.team,
  lane: nearestLane(runtime.body.y),
  spawnLane: runtime.lane,
  player: runtime.isPlayer,
  alive: runtime.alive,
  x: runtime.body.x,
  y: runtime.body.y,
  health: runtime.body.health,
  maxHealth: runtime.body.stats.maxHealth,
  stamina: runtime.body.stamina,
  maxStamina: runtime.body.stats.maxStamina,
  level: runtime.progression.level,
  xp: runtime.progression.xp,
  xpToNext: runtime.progression.xpToNext,
  attackDamage: runtime.body.stats.attackDamage,
  defense: runtime.body.stats.defense,
  moveSpeed: runtime.body.stats.moveSpeed,
  abilities: runtime.abilities.allStates(now),
});

/**
 * Read-only snapshot for a future CPU. Nothing here drives behavior yet.
 */
export const buildMatchGameState = (input: {
  now: number;
  match: MatchSnapshot;
  score: TeamScore;
  heroes: HeroRuntime[];
  emptyAllySlots: { team: TeamId; lane: LaneId }[];
  minions: MinionWorld;
  self: HeroRuntime | null;
}): MatchGameState => {
  const heroes = input.heroes.map((hero) => toHero(hero, input.now));
  const self = input.self ? toHero(input.self, input.now) : null;
  const allies = heroes.filter((hero) => self && hero.team === self.team && hero.instanceId !== self.instanceId);
  const enemies = heroes.filter((hero) => self && hero.team !== self.team);
  const minions: MinionQuery[] = input.minions.records().map((unit) => ({
    team: unit.body.team,
    lane: unit.lane,
    kind: unit.kind,
    waveId: unit.waveId,
    x: unit.body.x,
    y: unit.body.y,
    health: unit.body.health,
    maxHealth: unit.body.stats.maxHealth,
    distanceTo: (x: number, y: number) => Math.hypot(unit.body.x - x, unit.body.y - y),
  }));
  const lanes: LanePressure[] = (['top', 'mid', 'bottom'] as LaneId[]).map((lane) => ({
    lane,
    friendly: self ? input.minions.livingInLane(self.team, lane) : 0,
    enemy: self ? input.minions.livingInLane(self.team === 'alpha' ? 'bravo' : 'alpha', lane) : 0,
  }));
  const origin = self ?? { x: ARENA.width / 2, y: ARENA.height / 2, team: 'alpha' as TeamId };
  const nearbyAllies = allies.filter(
    (hero) => hero.alive && Math.hypot(hero.x - origin.x, hero.y - origin.y) <= NEAR,
  );
  const nearbyEnemies = enemies.filter(
    (hero) => hero.alive && Math.hypot(hero.x - origin.x, hero.y - origin.y) <= NEAR,
  );
  return {
    match: input.match,
    score: input.score,
    self,
    allies,
    enemies,
    emptyAllySlots: input.emptyAllySlots,
    minions,
    lanes,
    nearbyAllies,
    nearbyEnemies,
    fightNearby: nearbyEnemies.length > 0,
    outnumbered: nearbyEnemies.length > nearbyAllies.length + (self?.alive ? 1 : 0),
  };
};
