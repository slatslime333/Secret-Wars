import type { TeamId } from '../../config/hero';
import type { ObjectiveKind } from '../../config/objective';
import type { HeroRuntime } from '../HeroRuntime';

export type ObjectiveState =
  | 'idle'
  | 'capturing'
  | 'contested'
  | 'grace'
  | 'decaying'
  | 'complete';

export type ObjectiveHint = {
  kind: ObjectiveKind;
  x: number;
  y: number;
  radius: number;
  contested: boolean;
  decaying: boolean;
  owner: TeamId | null;
  selfProgress: number;
  enemyProgress: number;
  occupyingAllies: number;
  occupyingEnemies: number;
  nearbyAllies: number;
  nearbyEnemies: number;
  urgency: number;
  allyHeroId?: string;
  enemyHeroId?: string;
  allyX?: number;
  allyY?: number;
  enemyX?: number;
  enemyY?: number;
};

export type ObjectiveUiState = {
  kind: ObjectiveKind;
  x: number;
  y: number;
  radius: number;
  label: string;
  owner: TeamId | null;
  contested: boolean;
  decaying: boolean;
  progress: number;
  alphaProgress: number;
  bravoProgress: number;
  barMode: 'single' | 'dual';
};

export type ObjectiveContext = {
  now: number;
  delta: number;
  elapsedMs: number;
  heroes: readonly HeroRuntime[];
  playing: boolean;
};

export type ObjectiveCompleteEvent = {
  kind: ObjectiveKind;
  winner?: TeamId;
};

export type ObjectiveDeathEvent = {
  now: number;
  victim: HeroRuntime;
  killer?: HeroRuntime['body'];
};

/** One live battlefield event. Manager owns timing; the instance owns rules. */
export interface MatchObjective {
  readonly kind: ObjectiveKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  spawn(now: number): void;
  update(ctx: ObjectiveContext): ObjectiveCompleteEvent | undefined;
  hint(team: TeamId, heroes: readonly HeroRuntime[]): ObjectiveHint;
  ui(): ObjectiveUiState;
  cleanup(): void;
  onHeroDeath?(event: ObjectiveDeathEvent, heroes: readonly HeroRuntime[]): void;
}
