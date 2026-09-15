import type { TeamId } from '../config/hero';

export type WarEndSnapshot = {
  score: { self: number; enemy: number };
  heroKills: { self: number; enemy: number };
  objectives: { self: number; enemy: number };
  avgHp: { self: number; enemy: number };
};

/** Highest war score wins. Ties: hero kills → objectives → remaining avg HP → draw. */
export const resolveWarWinner = (input: WarEndSnapshot): TeamId | 'draw' => {
  if (input.score.self > input.score.enemy) {
    return 'alpha';
  }
  if (input.score.enemy > input.score.self) {
    return 'bravo';
  }
  if (input.heroKills.self !== input.heroKills.enemy) {
    return input.heroKills.self > input.heroKills.enemy ? 'alpha' : 'bravo';
  }
  if (input.objectives.self !== input.objectives.enemy) {
    return input.objectives.self > input.objectives.enemy ? 'alpha' : 'bravo';
  }
  if (input.avgHp.self > input.avgHp.enemy + 0.5) {
    return 'alpha';
  }
  if (input.avgHp.enemy > input.avgHp.self + 0.5) {
    return 'bravo';
  }
  return 'draw';
};

/** Dead or missing heroes count as 0 HP so a wiped team cannot fake a tie. */
export const teamAvgHp = (
  units: ReadonlyArray<{ team: TeamId; kind: string; hp: number }>,
): { self: number; enemy: number } => {
  const avg = (team: TeamId): number => {
    const heroes = units.filter((unit) => unit.team === team && unit.kind === 'hero');
    if (heroes.length === 0) {
      return 0;
    }
    return heroes.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0) / heroes.length;
  };
  return { self: avg('alpha'), enemy: avg('bravo') };
};
