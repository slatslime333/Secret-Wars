import type Phaser from 'phaser';
import { Projectile, type ProjectileHit } from '../../../combat/projectile';
import type { AbilityWorld } from '../AbilityWorld';
import type { NinjaBody } from '../../NinjaBody';
import { ROPE_SHOT } from './tunables';

export type RopeShotKind = 'light' | 'grab' | 'spray';

export const spawnRopeProjectile = (args: {
  scene: Phaser.Scene;
  world: AbilityWorld;
  caster: NinjaBody;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed?: number;
  radius?: number;
  lifetimeMs?: number;
  maxRange?: number;
  onHit?: (hit: ProjectileHit, now: number) => void;
  onMiss?: () => void;
}): Projectile => {
  const len = Math.hypot(args.dirX, args.dirY) || 1;
  const nx = args.dirX / len;
  const ny = args.dirY / len;
  const speed = args.speed ?? ROPE_SHOT.speed;
  const shot = new Projectile(
    args.scene,
    args.x,
    args.y,
    nx * speed,
    ny * speed,
    args.radius ?? ROPE_SHOT.radius,
    args.lifetimeMs ?? ROPE_SHOT.lifetimeMs,
    0xc4894a,
    'rope',
    args.maxRange ?? Number.POSITIVE_INFINITY,
  );
  let settled = false;
  args.world.addTicker({
    update: (now, delta, fighters) => {
      const enemies = fighters.filter((fighter) => fighter.team !== args.caster.team && !fighter.down);
      const result = shot.update(now, delta / 1000, enemies);
      if (result === 'dead') {
        if (!settled) {
          settled = true;
          args.onMiss?.();
        }
        return false;
      }
      if (result) {
        settled = true;
        args.onHit?.(result, now);
        return false;
      }
      return true;
    },
    destroy: () => {
      if (!settled) {
        settled = true;
        args.onMiss?.();
      }
      shot.destroy();
    },
  });
  return shot;
};
