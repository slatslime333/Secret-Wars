import { playWorld } from '../../../audio';
import { AbilityContext, AbilityDef } from '../types';
import { ABILITY_ICON } from '../icons';
import { COLE_BALL } from './tunables';
import { Projectile } from '../../../combat/projectile';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { spawnLightningBolt, spawnShockwaveRing } from '../../../effects/lightning';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { NinjaBody } from '../../NinjaBody';
import { distanceBetween } from '../geometry';

export const electricBallDef: AbilityDef = {
  id: 'cole-electric-ball',
  name: 'Electric Ball',
  slot: 'ability1',
  cooldownMs: COLE_BALL.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.electricBall,
  accent: 0x4aa8ff,
  aimOnRelease: true,
  padLabel: 'BALL',
  canActivate: (ctx) => !ctx.caster.status.isBlockStunned(ctx.now) && !ctx.caster.status.isClashLocked(ctx.now),
  activate: (ctx) => {
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    const nx = aim.x / len;
    const ny = aim.y / len;
    const shot = new Projectile(
      ctx.scene,
      ctx.caster.x + nx * 18,
      ctx.caster.y + ny * 18,
      nx * COLE_BALL.speed,
      ny * COLE_BALL.speed,
      COLE_BALL.radius,
      COLE_BALL.lifetimeMs,
      0x4aa8ff,
    );
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'BALL', 0x7ecbff);
    const caster = ctx.caster;
    const block = ctx.rivalBlock;
    ctx.world.addTicker({
      update: (now, delta, fighters) => {
        const enemies = fighters.filter((fighter) => fighter.team !== caster.team && !fighter.down);
        const result = shot.update(now, delta / 1000, enemies);
        if (result === 'dead') {
          return false;
        }
        if (result) {
          resolveBallHit(ctx.scene, now, caster, result.target, result.x, result.y, enemies, block);
          return false;
        }
        return true;
      },
      destroy: () => shot.destroy(),
    });
  },
};

const resolveBallHit = (
  scene: AbilityContext['scene'],
  now: number,
  caster: NinjaBody,
  primary: NinjaBody,
  x: number,
  y: number,
  enemies: NinjaBody[],
  rivalBlock: AbilityContext['rivalBlock'],
): void => {
  const kind = resolveAbilityHit(
    scene,
    now,
    caster,
    primary,
    {
      rawDamage: caster.stats.attackDamage * COLE_BALL.damageMul,
      knockback: caster.stats.knockbackPower * COLE_BALL.knockbackMul,
      staminaDamage: 8,
      dirX: primary.x - caster.x,
      dirY: primary.y - caster.y,
      step: 2,
      heavy: true,
    },
    rivalBlock,
  );
  if (kind !== 'hit') {
    return;
  }
  playWorld('cole-ball-impact', primary);
  primary.status.applySlow(now, COLE_BALL.slowMs, COLE_BALL.slowMul);

  spawnLightningBolt(scene, caster.x, caster.y, primary.x, primary.y, { heavy: true, life: 180 });
  spawnShockwaveRing(scene, x, y, COLE_BALL.explodeRadius);

  const chained: NinjaBody[] = [primary];
  const pool = enemies
    .filter((enemy) => enemy !== primary && !enemy.down)
    .sort((a, b) => distanceBetween(x, y, a.x, a.y) - distanceBetween(x, y, b.x, b.y));

  for (const enemy of pool) {
    if (chained.length >= COLE_BALL.maxTargets) {
      break;
    }
    const dist = distanceBetween(x, y, enemy.x, enemy.y);
    if (dist <= COLE_BALL.explodeRadius + enemy.stats.bodyRadius) {
      resolveAbilityHit(
        scene,
        now,
        caster,
        enemy,
        {
          rawDamage: caster.stats.attackDamage * COLE_BALL.chainDamageMul,
          knockback: caster.stats.knockbackPower * COLE_BALL.knockbackMul * 0.7,
          staminaDamage: 4,
          dirX: enemy.x - x,
          dirY: enemy.y - y,
          step: 2,
          heavy: true,
        },
        rivalBlock,
      );
      enemy.status.applySlow(now, COLE_BALL.chainSlowMs, COLE_BALL.chainSlowMul);
      spawnLightningBolt(scene, x, y, enemy.x, enemy.y, { heavy: false, life: 140 });
      playWorld('cole-ball-chain', enemy);
      chained.push(enemy);
      continue;
    }
    if (dist > COLE_BALL.chainRange) {
      continue;
    }
    const prev = chained[chained.length - 1];
    spawnLightningBolt(scene, prev.x, prev.y, enemy.x, enemy.y, { heavy: false, life: 160 });
    resolveAbilityHit(
      scene,
      now,
      caster,
      enemy,
      {
        rawDamage: caster.stats.attackDamage * COLE_BALL.chainDamageMul,
        knockback: caster.stats.knockbackPower * 0.7,
        staminaDamage: 3,
        dirX: enemy.x - prev.x,
        dirY: enemy.y - prev.y,
        step: 1,
        heavy: false,
      },
      rivalBlock,
    );
    playWorld('cole-ball-chain', enemy);
    enemy.status.applySlow(now, COLE_BALL.chainSlowMs, COLE_BALL.chainSlowMul);
    chained.push(enemy);
  }
};
