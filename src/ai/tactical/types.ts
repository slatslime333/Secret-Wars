import type { TeamId } from '../../config/hero';
import type { HeroRole } from '../../heroes/HeroDefinition';
import type { NinjaBody } from '../../heroes/NinjaBody';

/** High-level choices. Combat execution stays on the existing kits. */
export type TacticalAction =
  | 'advance'
  | 'attack'
  | 'assist_ally'
  | 'retreat'
  | 'reposition'
  | 'flank'
  | 'chase'
  | 'protect_ally'
  | 'finish_target'
  | 'switch_target'
  | 'hold_position'
  | 'wait_for_opening'
  | 'escape'
  | 'push_lane'
  | 'search_for_target'
  | 'intercept'
  | 'recover'
  | 'farm_minions'
  | 'regroup';

export type StrategicState =
  | 'opening'
  | 'advance'
  | 'hold'
  | 'flank'
  | 'engage'
  | 'support'
  | 'poke'
  | 'regroup'
  | 'retreat'
  | 'recover'
  | 'search'
  | 'patrol'
  | 'protect'
  | 'finish'
  | 'reposition';

export type OpeningPlan =
  | 'rush_center'
  | 'controlled_advance'
  | 'hold_near_spawn'
  | 'advance_behind_minions'
  | 'flank_left'
  | 'flank_right'
  | 'wide_rotation'
  | 'defensive_hold'
  | 'stay_back_poke'
  | 'move_to_ally'
  | 'scout_cautious'
  | 'indirect_center'
  | 'wait_for_team';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'extreme';

export type TacticalKind = 'hero' | 'minion';

export type Personality = {
  aggression: number;
  caution: number;
  assistTendency: number;
  retreatHp: number;
  persistence: number;
  flankTendency: number;
  bravery: number;
  thinkJitterMs: number;
  patience: number;
  teamwork: number;
  independence: number;
  riskTolerance: number;
  preferredDistance: number;
  retreatWillingness: number;
  abilityConservation: number;
  targetFixation: number;
  protectionInstinct: number;
  opportunism: number;
  reactionQuality: number;
};

export type KitStance = 'melee' | 'skirmish' | 'ranged' | 'support';

export type KitProfile = {
  heroId: string;
  stance: KitStance;
  preferredRange: number;
  comfortMin: number;
  comfortMax: number;
  wantsInitiate: boolean;
  wantsPoke: boolean;
  wantsFlank: boolean;
  wantsProtect: boolean;
  setupIds: readonly string[];
  defensiveIds: readonly string[];
  escapeIds: readonly string[];
  ultSaveUntilFoes: number;
};

export type ProjectileThreat = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  eta: number;
  willHit: boolean;
};

export type GamePlan = {
  state: StrategicState;
  opening: OpeningPlan;
  reason: string;
  until: number;
  anchorX: number;
  anchorY: number;
  preferredRange: number;
  savedUlt: boolean;
  reactingToShot: boolean;
  regrouping: boolean;
};

/** Phaser-free snapshot of one combatant for scoring. */
export type CombatantView = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimX: number;
  aimY: number;
  team: TeamId;
  kind: TacticalKind;
  role: HeroRole | string;
  heroId: string;
  hpRatio: number;
  staminaRatio: number;
  attackRange: number;
  moveSpeed: number;
  defense: number;
  power: number;
  attacking: boolean;
  stunned: boolean;
  recentlyHit: boolean;
  canAttack: boolean;
  lastAttackerId: number;
  visible: boolean;
};

export type UnitFact = CombatantView & {
  ref: NinjaBody;
};

export type ScoredAction = {
  action: TacticalAction;
  score: number;
  targetId: number;
  allyId: number;
  reason: string;
};

export type Situation = {
  self: CombatantView;
  allies: CombatantView[];
  enemies: CombatantView[];
  currentTargetId: number;
  kind: TacticalKind;
  personality: Personality;
  escapeOpen: boolean;
  homeX: number;
  homeY: number;
  vision: number;
  kit?: KitProfile;
  plan?: GamePlan;
  projectile?: ProjectileThreat;
  isolated?: boolean;
  lastSurvivor?: boolean;
  visibleHeroes?: number;
  allyHeroCount?: number;
  now?: number;
};

export type TacticalDebugInfo = {
  action: TacticalAction;
  targetLabel: string;
  targetScore: number;
  threat: ThreatLevel;
  allyCount: number;
  enemyCount: number;
  hp: string;
  reason: string;
  flanking: boolean;
  assisting: boolean;
  strategy: StrategicState;
  opening: OpeningPlan;
  preferredRange: number;
  projectile: boolean;
  regrouping: boolean;
  savedUlt: boolean;
};

export const NEUTRAL_PERSONALITY: Personality = {
  aggression: 0.5,
  caution: 0.5,
  assistTendency: 0.5,
  retreatHp: 0.2,
  persistence: 0.5,
  flankTendency: 0.5,
  bravery: 0.5,
  thinkJitterMs: 80,
  patience: 0.5,
  teamwork: 0.5,
  independence: 0.5,
  riskTolerance: 0.5,
  preferredDistance: 0.5,
  retreatWillingness: 0.5,
  abilityConservation: 0.5,
  targetFixation: 0.5,
  protectionInstinct: 0.5,
  opportunism: 0.5,
  reactionQuality: 0.5,
};
