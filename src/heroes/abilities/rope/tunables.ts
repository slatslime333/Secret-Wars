import { COLE_STORM } from '../cole/tunables';
import { DEATH_GUN, DEATH_SMASH } from '../death/tunables';
import { abilityDamage } from '../../../config/ratings';

/** Rope Man combat numbers. Light shots reuse converted ratings. */
export const ROPE_SHOT = {
  intervalMs: 400,
  /** 20% faster than Gun Barrage. */
  speed: Math.round(DEATH_GUN.speed * 1.2),
  radius: 4.5,
  lifetimeMs: 5000,
  /** Tighter than Gun Barrage's 0.13 rad cone. */
  spreadRad: 0.045,
  /** Visible left/right trajectory split, still accurate. */
  armOffsetRad: 0.055,
  armReach: 16,
  knockbackMul: 1.15,
  staminaDamage: 3,
} as const;

export const ROPE_DASH = {
  /** Farther than Ninja's 118px slide. */
  distance: 172,
  shootMs: 70,
  grabMs: 40,
  travelMs: 110,
  spreadRad: 0.34,
  jumpHeight: 28,
} as const;

export const ROPE_GRAB = {
  cooldownMs: 7000,
  range: 440,
  speed: Math.round(DEATH_GUN.speed * 1.35),
  radius: 7,
  lifetimeMs: 900,
  slingMs: 160,
} as const;

export const ROPE_PUNCH = {
  cooldownMs: 8000,
  animMs: 620,
  impactAt: 280,
  /** Slightly smaller / shorter than Bat Smash (~137). */
  radius: Math.round(DEATH_SMASH.radius * 0.86),
  damageRating: 54,
  damage: abilityDamage(54),
  knockback: 760,
  launchCap: 860,
  staminaDamage: 7,
  slowMul: 0.65,
  slowMs: 2000,
  jumpHeight: 36,
} as const;

export const ROPE_SPRAY = {
  durationMs: 5000,
  /** Same effective reach as Cole's Thunderstorm. */
  range: COLE_STORM.radius,
  intervalMs: 300,
  shotsPerPulse: 2,
  speed: Math.round(DEATH_GUN.speed * 1.2),
  radius: 4.5,
  damageRating: 36,
  damage: abilityDamage(36),
  knockbackMul: 0.55,
  paralyzeMs: 2000,
  moveMul: 0.42,
} as const;
