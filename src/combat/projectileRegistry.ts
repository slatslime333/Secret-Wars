import type { TeamId } from '../config/hero';

export type ProjectilePose = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  team?: TeamId;
};

type ProjectileLike = {
  pose: () => ProjectilePose;
};

const live: ProjectileLike[] = [];

export const registerProjectile = (shot: ProjectileLike): void => {
  live.push(shot);
};

export const unregisterProjectile = (shot: ProjectileLike): void => {
  const index = live.indexOf(shot);
  if (index >= 0) {
    live.splice(index, 1);
  }
};

export const listProjectilePoses = (): ProjectilePose[] => {
  const out: ProjectilePose[] = [];
  for (const shot of live) {
    out.push(shot.pose());
  }
  return out;
};
