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
  | 'intercept';

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
  hpRatio: number;
  staminaRatio: number;
  ammoRatio: number;
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
};
