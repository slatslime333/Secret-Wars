import { CRATE } from '../config/crate';
import { ENV_WORLD } from '../config/environment';
import type { DamageState, MapObstacle, PhysicsClass } from './types';

export const physicsClassOf = (obs: Pick<MapObstacle, 'kind' | 'variant' | 'explosive'>): PhysicsClass => {
  if (obs.kind === 'barrel' || obs.explosive) {
    return 'explosive';
  }
  if (obs.kind === 'tree' || obs.kind === 'fence') {
    return 'lightweight';
  }
  if (obs.kind === 'crate' || obs.kind === 'wall' || obs.kind === 'barricade' || obs.kind === 'sandbag') {
    return 'breakable';
  }
  if (obs.kind === 'vehicle') {
    return obs.variant === 'car' ? 'breakable' : 'static';
  }
  return 'static';
};

export const maxHpOf = (obs: Pick<MapObstacle, 'kind' | 'variant' | 'explosive'>): number => {
  switch (obs.kind) {
    case 'crate':
      return CRATE.maxHealth;
    case 'wall':
      return ENV_WORLD.wallHp;
    case 'tree':
      return ENV_WORLD.treeHp;
    case 'fence':
      return ENV_WORLD.fenceHp;
    case 'barricade':
      return ENV_WORLD.barricadeHp;
    case 'sandbag':
      return ENV_WORLD.sandbagHp;
    case 'barrel':
      return ENV_WORLD.barrelHp;
    case 'vehicle':
      return obs.variant === 'truck' ? ENV_WORLD.truckHp : ENV_WORLD.carHp;
    case 'building':
      return ENV_WORLD.buildingCosmeticHp;
    default:
      return 9999;
  }
};

export const isDestructibleKind = (kind: MapObstacle['kind'], variant?: string): boolean => {
  if (kind === 'rubble' || kind === 'building') {
    return false;
  }
  if (kind === 'vehicle' && variant === 'truck') {
    return false;
  }
  return (
    kind === 'crate' ||
    kind === 'wall' ||
    kind === 'tree' ||
    kind === 'fence' ||
    kind === 'barricade' ||
    kind === 'sandbag' ||
    kind === 'barrel' ||
    kind === 'vehicle'
  );
};

export const damageStateOf = (hp: number, maxHp: number, knocked: boolean): DamageState => {
  if (knocked) {
    return 'knocked';
  }
  if (hp <= 0) {
    return 'destroyed';
  }
  const ratio = hp / Math.max(1, maxHp);
  if (ratio <= 0.34) {
    return 'cracked';
  }
  if (ratio <= 0.7) {
    return 'damaged';
  }
  return 'intact';
};

const hashId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const decorateObstacle = (obs: MapObstacle): MapObstacle => {
  const explosive =
    obs.kind === 'barrel' || (obs.kind === 'vehicle' && obs.variant === 'car' && hashId(obs.id) % 100 < 28);
  const destructible = obs.kind === 'crate' || isDestructibleKind(obs.kind, obs.variant) || explosive;
  const physicsClass = physicsClassOf({ ...obs, explosive });
  const maxHp = maxHpOf({ ...obs, explosive });
  obs.explosive = explosive;
  obs.destructible = destructible;
  obs.physicsClass = physicsClass;
  obs.maxHp = maxHp;
  obs.hp = destructible ? maxHp : obs.hp;
  obs.damageState = 'intact';
  return obs;
};
