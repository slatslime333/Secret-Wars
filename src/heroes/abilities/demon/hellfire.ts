import Phaser from 'phaser';
import { playWorld } from '../../../audio';
import { spawnCombatCallout } from '../../../effects/combatCallout';
import { Projectile } from '../../../combat/projectile';
import { resolveAbilityHit } from '../resolveAbilityHit';
import type { AbilityWorld } from '../AbilityWorld';
import { AbilityContext, AbilityDef, canStartAbility } from '../types';
import { ABILITY_ICON } from '../icons';
import { DEMON_HELLFIRE } from './tunables';
import { applyBurn } from './burnFx';
import { distanceBetween } from '../geometry';
import type { NinjaBody } from '../../NinjaBody';

export const hellfireDef: AbilityDef = {
  id: 'demon-hellfire',
  name: 'Hellfire',
  slot: 'ability1',
  cooldownMs: DEMON_HELLFIRE.cooldownMs,
  chargeMode: 'cooldown',
  startingCharges: 1,
  maxCharges: 1,
  iconKey: ABILITY_ICON.hellfire,
  accent: 0xff6a18,
  aimOnRelease: true,
  padLabel: 'HELL',
  tactics: { roles: ['aoe', 'space', 'damage', 'setup', 'disruption'], range: DEMON_HELLFIRE.range },
  canActivate: (ctx) => canStartAbility(ctx),
  activate: (ctx) => {
    const aim = ctx.aimOverride ?? ctx.caster.aim;
    const len = Math.hypot(aim.x, aim.y) || 1;
    const nx = aim.x / len;
    const ny = aim.y / len;
    const originX = ctx.caster.x + nx * 14;
    const originY = ctx.caster.y + ny * 10;
    const shot = new Projectile(
      ctx.scene,
      originX,
      originY,
      nx * DEMON_HELLFIRE.throwSpeed,
      ny * DEMON_HELLFIRE.throwSpeed,
      DEMON_HELLFIRE.candleRadius,
      (DEMON_HELLFIRE.range / DEMON_HELLFIRE.throwSpeed) * 1000 + 80,
      0xff7a20,
      'flame',
      DEMON_HELLFIRE.range,
      { x: originX, y: originY },
      ctx.caster.team,
    );
    spawnCombatCallout(ctx.scene, ctx.caster.x, ctx.caster.y, 'HELLFIRE', 0xff6a18);
    playWorld('cole-ball-cast', ctx.caster);
    ctx.caster.playCustomAttack(ctx.now, 180, (frac) => ({
      armLiftRight: 0.2 + Math.sin(frac * Math.PI) * 1.1,
      armLiftLeft: 0.1,
      swayX: nx * 4 * Math.sin(frac * Math.PI),
    }));
    const caster = ctx.caster;
    const block = ctx.rivalBlock;
    const world = ctx.world;
    ctx.world.addTicker({
      update: (now, delta, fighters) => {
        const pose = shot.pose();
        const enemies = fighters.filter((fighter) => fighter.team !== caster.team && !fighter.down);
        const result = shot.update(now, delta / 1000, enemies);
        if (!result) {
          return true;
        }
        const x = result === 'dead' ? pose.x : result.x;
        const y = result === 'dead' ? pose.y : result.y;
        beginHellfire(ctx.scene, world, now, caster, x, y, fighters, block);
        return false;
      },
      destroy: () => shot.destroy(),
    });
  },
};

const beginHellfire = (
  scene: Phaser.Scene,
  world: AbilityWorld,
  now: number,
  caster: NinjaBody,
  x: number,
  y: number,
  fighters: NinjaBody[],
  rivalBlock: AbilityContext['rivalBlock'],
): void => {
  explodeHellfire(scene, now, caster, x, y, fighters, rivalBlock);
  const field = new HellfireField(scene, x, y, now);
  const hitAt = new WeakMap<NinjaBody, number>();
  world.addTicker({
    update: (tickNow, _delta, live) => {
      field.redraw(tickNow);
      if (tickNow >= now + DEMON_HELLFIRE.durationMs) {
        return false;
      }
      for (const enemy of live) {
        if (enemy.down || enemy.team === caster.team) {
          continue;
        }
        if (distanceBetween(enemy.x, enemy.y, x, y) > DEMON_HELLFIRE.radius) {
          continue;
        }
        applyBurn(enemy, tickNow, 'hellfire', caster);
        const last = hitAt.get(enemy) ?? 0;
        if (tickNow - last < DEMON_HELLFIRE.tickMs) {
          continue;
        }
        hitAt.set(enemy, tickNow);
        resolveAbilityHit(
          scene,
          tickNow,
          caster,
          enemy,
          {
            rawDamage: DEMON_HELLFIRE.tickDamage,
            knockback: 36,
            staminaDamage: 1,
            dirX: enemy.x - x,
            dirY: enemy.y - y,
            step: 1,
            heavy: false,
            hitReactionMs: 50,
            sourceKind: 'ability',
            abilityId: hellfireDef.id,
          },
          rivalBlock,
        );
      }
      return true;
    },
    destroy: () => field.destroy(),
  });
};

const explodeHellfire = (
  scene: Phaser.Scene,
  now: number,
  caster: NinjaBody,
  x: number,
  y: number,
  fighters: NinjaBody[],
  rivalBlock: AbilityContext['rivalBlock'],
): void => {
  playWorld('ninja-smoke', caster);
  spawnCombatCallout(scene, x, y, 'FIRE', 0xffc030);
  for (const enemy of fighters) {
    if (enemy.down || enemy.team === caster.team) {
      continue;
    }
    if (distanceBetween(enemy.x, enemy.y, x, y) > DEMON_HELLFIRE.radius) {
      continue;
    }
    const kind = resolveAbilityHit(
      scene,
      now,
      caster,
      enemy,
      {
        rawDamage: DEMON_HELLFIRE.explodeDamage,
        knockback: caster.stats.knockbackPower * DEMON_HELLFIRE.knockbackMul,
        staminaDamage: DEMON_HELLFIRE.staminaDamage,
        dirX: enemy.x - x,
        dirY: enemy.y - y,
        step: 1,
        heavy: false,
        sourceKind: 'ability',
        abilityId: hellfireDef.id,
      },
      rivalBlock,
    );
    if (kind === 'hit') {
      applyBurn(enemy, now, 'hellfire', caster);
    }
  }
};

class HellfireField {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly startedAt: number;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    now: number,
  ) {
    this.startedAt = now;
    this.gfx = scene.add.graphics().setDepth(8);
    this.redraw(now);
  }

  redraw(now: number): void {
    const age = now - this.startedAt;
    const left = DEMON_HELLFIRE.durationMs - age;
    const fade = left < 500 ? Math.max(0, left / 500) : 1;
    const pulse = 0.72 + Math.sin(now / 90) * 0.1;
    const r = DEMON_HELLFIRE.radius;
    const g = this.gfx;
    g.clear();
    g.setPosition(this.x, this.y);
    g.fillStyle(0x4a1008, 0.28 * fade);
    g.fillCircle(0, 0, r * pulse);
    g.lineStyle(4, 0xff4a10, 0.85 * fade);
    drawPentagram(g, r * 0.72);
    g.lineStyle(2, 0xffe070, 0.7 * fade);
    drawPentagram(g, r * 0.58);
    g.fillStyle(0xff6a18, 0.55 * fade);
    for (let i = 0; i < 7; i += 1) {
      const a = now / 140 + i * 0.9;
      g.fillEllipse(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, 10, 16);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

const drawPentagram = (g: Phaser.GameObjects.Graphics, radius: number): void => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  g.lineTo(pts[2].x, pts[2].y);
  g.lineTo(pts[4].x, pts[4].y);
  g.lineTo(pts[1].x, pts[1].y);
  g.lineTo(pts[3].x, pts[3].y);
  g.closePath();
  g.strokePath();
  g.strokeCircle(0, 0, radius * 1.08);
};
