import { COLE } from './cole';
import { CRATE } from './crate';

/**
 * Living-city tunables. Sparse landmarks, restrained destruction, no rubble piles.
 */
export const ENV_WORLD = {
  wallHp: Math.round(COLE.attackDamage * 7.2),
  treeHp: Math.round(COLE.attackDamage * 5.4),
  fenceHp: Math.round(COLE.attackDamage * 3.6),
  barricadeHp: Math.round(COLE.attackDamage * 6.2),
  sandbagHp: Math.round(COLE.attackDamage * 4.4),
  barrelHp: Math.round(COLE.attackDamage * 2.8),
  carHp: Math.round(COLE.attackDamage * 9.5),
  truckHp: Math.round(COLE.attackDamage * 14),
  buildingCosmeticHp: Math.round(COLE.attackDamage * 18),

  walkPush: 42,
  lightPush: 118,
  heavyPush: 210,
  abilityPush: 260,
  dashPush: 240,
  dashHit: 9,
  explosionPush: 520,
  treeMass: 1.15,
  treeDrag: 3.4,
  treeAngularDrag: 2.8,
  treeWalkSlow: 0.62,
  knockedLifetimeMs: 20_000,
  knockFadeMs: 900,
  wreckLifeMs: 16_000,
  smokeGapMs: 380,

  barrelRadius: 72,
  barrelDamage: 22,
  barrelKnockback: 280,
  barrelChainRadius: 48,

  crateRespawnMs: 28_000,
  crateOccupiedPad: 28,
  maxCrates: 16,

  maxBarrels: 6,
  maxEnterable: 2,
  maxFx: 10,
  fxLifeMs: 520,
  stainLifeMs: 18_000,

  roofFadeMs: 180,
  roofInsideAlpha: 0.16,
  roofOutsideAlpha: 1,
  roofDepth: 11,

  snapshotRadius: 340,
  debug: false,
} as const;

export const crateRespawnMs = (): number => ENV_WORLD.crateRespawnMs;

export { CRATE };
