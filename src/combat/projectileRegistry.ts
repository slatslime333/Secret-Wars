import type { TeamId } from '../config/hero';

export type ProjectilePose = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  team?: TeamId;
};

type ProjectileLike = {
  pose: () => Omit<ProjectilePose, 'id'> & { id?: number };
};

type LiveShot = {
  shot: ProjectileLike;
  id: number;
};

const live: LiveShot[] = [];
let nextId = 1;

export const registerProjectile = (shot: ProjectileLike): void => {
  live.push({ shot, id: nextId });
  nextId += 1;
};

export const unregisterProjectile = (shot: ProjectileLike): void => {
  const index = live.findIndex((entry) => entry.shot === shot);
  if (index >= 0) {
    live.splice(index, 1);
  }
};

export const listProjectilePoses = (): ProjectilePose[] => {
  const out: ProjectilePose[] = [];
  for (const entry of live) {
    const pose = entry.shot.pose();
    out.push({ ...pose, id: pose.id ?? entry.id });
  }
  return out;
};
