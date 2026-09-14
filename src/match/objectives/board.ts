import type { TeamId } from '../../config/hero';
import type { ObjectiveHint } from './types';
import type { ObjectiveKind } from '../../config/objective';

export type ObjectiveWorld = {
  kind: ObjectiveKind;
  x: number;
  y: number;
  radius: number;
  contested: boolean;
  decaying: boolean;
  owner: TeamId | null;
  alphaProgress: number;
  bravoProgress: number;
  occupyingAlpha: number;
  occupyingBravo: number;
  nearbyAlpha: number;
  nearbyBravo: number;
  urgency: number;
  alphaHeroId?: string;
  bravoHeroId?: string;
  alphaX?: number;
  alphaY?: number;
  bravoX?: number;
  bravoY?: number;
};

let world: ObjectiveWorld | undefined;

export const setObjectiveWorld = (next: ObjectiveWorld | undefined): void => {
  world = next;
};

export const objectiveWorld = (): ObjectiveWorld | undefined => world;

export const objectiveHintFor = (team: TeamId): ObjectiveHint | undefined => {
  if (!world) {
    return undefined;
  }
  const foe: TeamId = team === 'alpha' ? 'bravo' : 'alpha';
  return {
    kind: world.kind,
    x: world.x,
    y: world.y,
    radius: world.radius,
    contested: world.contested,
    decaying: world.decaying,
    owner: world.owner,
    selfProgress: team === 'alpha' ? world.alphaProgress : world.bravoProgress,
    enemyProgress: foe === 'alpha' ? world.alphaProgress : world.bravoProgress,
    occupyingAllies: team === 'alpha' ? world.occupyingAlpha : world.occupyingBravo,
    occupyingEnemies: foe === 'alpha' ? world.occupyingAlpha : world.occupyingBravo,
    nearbyAllies: team === 'alpha' ? world.nearbyAlpha : world.nearbyBravo,
    nearbyEnemies: foe === 'alpha' ? world.nearbyAlpha : world.nearbyBravo,
    urgency: world.urgency,
    allyHeroId: team === 'alpha' ? world.alphaHeroId : world.bravoHeroId,
    enemyHeroId: foe === 'alpha' ? world.alphaHeroId : world.bravoHeroId,
    allyX: team === 'alpha' ? world.alphaX : world.bravoX,
    allyY: team === 'alpha' ? world.alphaY : world.bravoY,
    enemyX: foe === 'alpha' ? world.alphaX : world.bravoX,
    enemyY: foe === 'alpha' ? world.alphaY : world.bravoY,
  };
};
