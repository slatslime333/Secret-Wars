import Phaser from 'phaser';
import { COMBAT } from '../../../config/combat';
import { DEATH_DASH } from './tunables';
import { sweepKnockback, swingSignFor } from './sweep';
import { resolveAbilityHit } from '../resolveAbilityHit';
import { breakProps } from '../../../match/objectives/worldStrike';
import { AbilityWorld } from '../AbilityWorld';
import { NinjaBody } from '../../NinjaBody';
import { BlockController } from '../../../combat/BlockController';
import { isInAttackArc } from '../../../combat/hitDetection';

/**
 * Dash carries a bat sweep. Odd dashes swing left → right, even right → left.
 */
export const startDeathDashSweep = (
  scene: Phaser.Scene,
  world: AbilityWorld,
  caster: NinjaBody,
  now: number,
  dashIndex: number,
  dir: Phaser.Math.Vector2,
  enemies: NinjaBody[],
  rivalBlock?: BlockController,
): void => {
  const sign = swingSignFor(dashIndex % 2 === 0 ? 'dash-a' : 'dash-b');
  const hit = new Set<NinjaBody>();
  const endsAt = now + COMBAT.dashDurationMs + 40;
  spawnDashArc(scene, caster, dir, sign);
  breakProps({
    attacker: caster,
    now,
    damage: DEATH_DASH.damage,
    reach: COMBAT.dashDistance + caster.stats.attackRange * 0.35,
    dirX: dir.x,
    dirY: dir.y,
    halfArc: ((caster.stats.attackArcDegrees * Math.PI) / 360) * 1.2,
    impulse: 1.45,
  });
  caster.playCustomAttack(now, COMBAT.dashDurationMs + 40, (frac) => ({
    swordAngleOffset: -0.9 * sign + 1.8 * sign * frac,
    batScale: 1.15,
    armLiftRight: 0.4,
    swayX: dir.x * 4,
  }));

  world.addTicker({
    update: (tickNow) => {
      if (tickNow >= endsAt || caster.down) {
        return false;
      }
      const half = (caster.stats.attackArcDegrees * Math.PI) / 360;
      for (const enemy of enemies) {
        if (enemy.down || hit.has(enemy)) {
          continue;
        }
        if (
          !isInAttackArc(
            caster.x,
            caster.y,
            dir.x,
            dir.y,
            enemy.x,
            enemy.y,
            caster.stats.attackRange + COMBAT.hitForgiveness + 8,
            half * 1.15,
            enemy.stats.bodyRadius,
          )
        ) {
          continue;
        }
        const kb = sweepKnockback(dir.x, dir.y, sign);
        const kind = resolveAbilityHit(
          scene,
          tickNow,
          caster,
          enemy,
          {
            rawDamage: DEATH_DASH.damage,
            knockback: caster.stats.knockbackPower * DEATH_DASH.knockbackMul,
            staminaDamage: 5,
            dirX: kb.x,
            dirY: kb.y,
            step: 2,
            heavy: false,
          },
          rivalBlock,
        );
        if (kind !== 'whiff') {
          hit.add(enemy);
        }
      }
      return true;
    },
  });
};

const spawnDashArc = (
  scene: Phaser.Scene,
  caster: NinjaBody,
  dir: Phaser.Math.Vector2,
  sign: number,
): void => {
  const graphics = scene.add.graphics().setDepth(18);
  const aim = Math.atan2(dir.y, dir.x);
  const start = aim - 0.95 * sign;
  const anim = { t: 0 };
  scene.tweens.add({
    targets: anim,
    t: 1,
    duration: 160,
    ease: 'Cubic.Out',
    onUpdate: () => {
      graphics.clear();
      graphics.setPosition(caster.x, caster.y);
      const end = start + 1.9 * sign * anim.t;
      const a0 = sign >= 0 ? start : end;
      const a1 = sign >= 0 ? end : start;
      graphics.lineStyle(10, 0x3a2410, 0.45 * (1 - anim.t * 0.3));
      graphics.beginPath();
      graphics.arc(0, 0, caster.stats.attackRange * 0.9, a0, a1);
      graphics.strokePath();
      graphics.lineStyle(4, 0xc68654, 0.9);
      graphics.beginPath();
      graphics.arc(0, 0, caster.stats.attackRange * 0.9, a0, a1);
      graphics.strokePath();
    },
    onComplete: () => graphics.destroy(),
  });
};
